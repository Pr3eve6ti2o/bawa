package com.bawa.wallet.data

import com.bawa.wallet.data.network.HttpTransport
import com.bawa.wallet.data.network.OkHttpHttpTransport
import com.bawa.wallet.data.network.getText
import com.bawa.wallet.data.network.postJsonText
import java.math.BigInteger
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Live native + token balances (Step 5, Lane B). Mirrors the web's
// adapters (apps/web/src/wallet/adapters/): EVM eth_getBalance and
// ERC-20 balanceOf over the chain's registry RPCs in order (first 200
// wins), Solana getBalance, TRON Trongrid -> PublicNode, TON TonCenter
// -> TonAPI, BTC/LTC Esplora, DOGE SoChain -> BlockCypher. Keyless
// sources only; a chain with no keyless source answers Unavailable
// with the reason, never $0.00 and never an invented balance. Read-only
// throughout: no signing, no broadcast, no funds moved.
//
// The BalanceRepository contract covers the native balance only, so
// token balances live on the extra tokenBalance/tokenBalances methods
// below (same transport, same sweep rules).

class LiveBalanceRepository(
    private val registry: ChainRegistry,
    private val tokens: TokenRepository,
    private val transport: HttpTransport = OkHttpHttpTransport()
) : BalanceRepository {

    override suspend fun balance(chainId: String, address: String): BalanceResult {
        val chain = registry.chainById(chainId)
            ?: return BalanceResult.Unavailable(
                "Unknown chain \"$chainId\": no balance source is configured."
            )
        return try {
            when (chainId) {
                "sol" -> solBalance(chain, address)
                "trx" -> tronBalance(chain, address)
                "ton" -> tonBalance(chain, address)
                "btc", "ltc" -> esploraBalance(chain, address)
                "doge" -> dogeBalance(chain, address)
                else -> if (chain.evmChainId != null) {
                    evmBalance(chain, address)
                } else {
                    BalanceResult.Unavailable(
                        "No keyless balance source covers ${chain.name} yet, " +
                            "so no balance can be shown."
                    )
                }
            }
        } catch (e: Exception) {
            BalanceResult.Unavailable(
                "Balance lookup failed for ${chain.name}: ${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    // --- Native balances -------------------------------------------------

    private suspend fun evmBalance(chain: ChainRecord, address: String): BalanceResult {
        if (!isEvmAddress(address)) {
            return BalanceResult.Unavailable("Invalid Ethereum address.")
        }
        val result = sweepJsonRpc(
            chain.rpcEndpoints,
            "eth_getBalance",
            buildJsonArray {
                add(JsonPrimitive(address))
                add(JsonPrimitive("latest"))
            }
        ) ?: return BalanceResult.Unavailable(
            "All RPC endpoints failed for ${chain.name}; no balance could be read."
        )
        val raw = try {
            hexToBigInteger(result.jsonPrimitive.content)
        } catch (e: Exception) {
            null
        }
            ?: return BalanceResult.Unavailable(
                "The RPC answer for ${chain.name} was not a balance."
            )
        return BalanceResult.Available(raw.toString(), chain.decimals)
    }

    private suspend fun solBalance(chain: ChainRecord, address: String): BalanceResult {
        val result = sweepJsonRpc(
            chain.rpcEndpoints,
            "getBalance",
            buildJsonArray { add(JsonPrimitive(address)) }
        ) ?: return BalanceResult.Unavailable(
            "All RPC endpoints failed for ${chain.name}; no balance could be read."
        )
        // getBalance answers { context, value: <lamports> }.
        val value = try {
            result.jsonObject.numberStringField("value")
        } catch (e: Exception) {
            null
        }
            ?: return BalanceResult.Unavailable(
                "The Solana RPC answer was not a balance."
            )
        return BalanceResult.Available(BigInteger(value).toString(), chain.decimals)
    }

    private suspend fun tronBalance(chain: ChainRecord, address: String): BalanceResult {
        if (!isTronAddress(address)) {
            return BalanceResult.Unavailable("Invalid TRON address.")
        }
        // Trongrid first, then the PublicNode full node — the web's
        // 2026-11-28 fallback order (Trongrid's keyless tier 429s the
        // shared egress IP; TronScan 405s triggerconstantcontract and
        // is never used here). Each registry endpoint is tried in the
        // shape its host serves.
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val balance = if (base.contains("trongrid.io")) {
                    tronGridBalance(base, address)
                } else {
                    publicNodeTronBalance(base, address)
                }
                if (balance != null) {
                    return BalanceResult.Available(balance, chain.decimals)
                }
                lastError = "unexpected response shape from $base"
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        return BalanceResult.Unavailable(
            "All TRON endpoints failed; no balance could be read." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    /** Trongrid GET /v1/accounts/{address}: data[0].balance in SUN; an empty data list is an exact zero. */
    private suspend fun tronGridBalance(base: String, address: String): String? {
        val text = transport.getText("$base/v1/accounts/$address")
        val root = parseJsonObject(text) ?: return null
        val data = try {
            root["data"]?.jsonArray
        } catch (e: Exception) {
            null
        } ?: return null
        if (data.isEmpty()) return "0"
        val first = try {
            data[0].jsonObject
        } catch (e: Exception) {
            null
        } ?: return null
        return first.numberStringField("balance")?.let { BigInteger(it).toString() } ?: "0"
    }

    /** PublicNode POST /wallet/getaccount {address, visible:true}: {balance} in SUN; {} is an exact zero. */
    private suspend fun publicNodeTronBalance(base: String, address: String): String? {
        val body = buildJsonObject {
            put("address", address)
            put("visible", true)
        }.toString()
        val text = transport.postJsonText("$base/wallet/getaccount", body)
        val root = parseJsonObject(text) ?: return null
        if (root.stringField("Error") != null) return null
        val returned = root.stringField("address")
        if (returned != null && returned != address) return null
        val balance = root.numberStringField("balance") ?: return "0"
        return BigInteger(balance).toString()
    }

    private suspend fun tonBalance(chain: ChainRecord, address: String): BalanceResult {
        if (!isTonAddress(address)) {
            return BalanceResult.Unavailable("Invalid TON address.")
        }
        // TonCenter JSON-RPC first (the registry endpoint), then the
        // TonAPI REST account read — the web's fallback order.
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val result = jsonRpcCall(base, "getAddressBalance", buildJsonObject {
                    put("address", address)
                })
                val balance = try {
                    result.jsonPrimitive.content
                } catch (e: Exception) {
                    null
                }?.takeIf { it.matches(Regex("\\d+")) }
                if (balance != null) {
                    return BalanceResult.Available(BigInteger(balance).toString(), chain.decimals)
                }
                lastError = "unexpected response shape from $base"
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        try {
            val text = transport.getText("$TONAPI_BASE_URL/v2/accounts/$address")
            val balance = parseJsonObject(text)?.stringField("balance")
                ?.takeIf { it.matches(Regex("\\d+")) }
            if (balance != null) {
                return BalanceResult.Available(BigInteger(balance).toString(), chain.decimals)
            }
        } catch (e: Exception) {
            lastError = "${e.message ?: e.javaClass.simpleName} ($TONAPI_BASE_URL)"
        }
        return BalanceResult.Unavailable(
            "All TON endpoints failed; no balance could be read." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    private suspend fun esploraBalance(chain: ChainRecord, address: String): BalanceResult {
        // mempool.space / blockstream.info (BTC) and litecoinspace.org
        // (LTC): GET /address/{address} -> chain_stats funded - spent.
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val text = transport.getText("$base/address/$address")
                val stats = parseJsonObject(text)?.objectField("chain_stats")
                if (stats == null) {
                    lastError = "unexpected response shape from $base"
                    continue
                }
                val funded = stats.numberStringField("funded_txo_sum")
                val spent = stats.numberStringField("spent_txo_sum")
                if (funded == null || spent == null) {
                    lastError = "unexpected response shape from $base"
                    continue
                }
                val balance = BigInteger(funded).subtract(BigInteger(spent))
                return BalanceResult.Available(balance.toString(), chain.decimals)
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        return BalanceResult.Unavailable(
            "All ${chain.name} endpoints failed; no balance could be read." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    private suspend fun dogeBalance(chain: ChainRecord, address: String): BalanceResult {
        // SoChain first, then BlockCypher — the web's order.
        try {
            val text = transport.getText("$SOCHAIN_BASE/balance/DOGE/$address")
            val data = parseJsonObject(text)?.objectField("data")
            val confirmed = data?.stringField("confirmed")
            if (parseJsonObject(text)?.stringField("status") == "success" && confirmed != null) {
                val koinu = decimalToBaseUnits(confirmed, chain.decimals)
                    ?: return BalanceResult.Unavailable(
                        "The SoChain answer for Dogecoin was not a balance."
                    )
                return BalanceResult.Available(koinu.toString(), chain.decimals)
            }
        } catch (e: Exception) {
            // Fall through to BlockCypher.
        }
        try {
            val text = transport.getText("$BLOCKCYPHER_DOGE_BASE/addrs/$address/balance")
            val balance = parseJsonObject(text)?.numberStringField("balance")
            if (balance != null) {
                return BalanceResult.Available(BigInteger(balance).toString(), chain.decimals)
            }
        } catch (e: Exception) {
            return BalanceResult.Unavailable(
                "All Dogecoin endpoints failed; no balance could be read. " +
                    "Last error: ${e.message ?: e.javaClass.simpleName}"
            )
        }
        return BalanceResult.Unavailable(
            "All Dogecoin endpoints failed; no balance could be read."
        )
    }

    // --- Token balances --------------------------------------------------

    /**
     * Balance of one curated token for [address]. ERC-20 on EVM chains
     * (eth_call balanceOf) and TRC-20 on TRON (triggerconstantcontract).
     * SPL (Solana) and Jetton (TON) tokens answer Unavailable — their
     * reads are not implemented here, and the honest answer is to say so.
     */
    suspend fun tokenBalance(token: TokenRecord, address: String): BalanceResult {
        val chain = registry.chainById(token.chain)
            ?: return BalanceResult.Unavailable(
                "Unknown chain \"${token.chain}\": no token balance source is configured."
            )
        return try {
            when {
                token.chain == "trx" -> tronTokenBalance(token, chain, address)
                chain.evmChainId != null -> evmTokenBalance(token, chain, address)
                else -> BalanceResult.Unavailable(
                    "Token balances for ${chain.name} are not supported yet, " +
                        "so no ${token.symbol} balance can be shown."
                )
            }
        } catch (e: Exception) {
            BalanceResult.Unavailable(
                "Token balance lookup failed for ${token.symbol} on ${chain.name}: " +
                    (e.message ?: e.javaClass.simpleName)
            )
        }
    }

    /** Balances of every curated token on [chainId] for [address]. */
    suspend fun tokenBalances(
        chainId: String,
        address: String
    ): List<Pair<TokenRecord, BalanceResult>> {
        return tokens.tokensForChain(chainId).map { it to tokenBalance(it, address) }
    }

    private suspend fun evmTokenBalance(
        token: TokenRecord,
        chain: ChainRecord,
        address: String
    ): BalanceResult {
        if (!isEvmAddress(address)) {
            return BalanceResult.Unavailable("Invalid Ethereum address.")
        }
        if (!isEvmAddress(token.contract)) {
            return BalanceResult.Unavailable("Invalid token contract address.")
        }
        val data = BALANCE_OF_SELECTOR + paddedAddressWord(address)
        val result = sweepEthCall(chain.rpcEndpoints, token.contract, data)
            ?: return BalanceResult.Unavailable(
                "All RPC endpoints failed for ${chain.name}; " +
                    "no ${token.symbol} balance could be read."
            )
        val raw = try {
            hexToBigInteger(result.jsonPrimitive.content)
        } catch (e: Exception) {
            null
        }
            ?: return BalanceResult.Unavailable(
                "The RPC answer for ${token.symbol} was not a balance."
            )
        return BalanceResult.Available(raw.toString(), token.decimals)
    }

    private suspend fun tronTokenBalance(
        token: TokenRecord,
        chain: ChainRecord,
        address: String
    ): BalanceResult {
        if (!isTronAddress(address)) {
            return BalanceResult.Unavailable("Invalid TRON address.")
        }
        val ownerHex = tronAddressToHex(address)
            ?: return BalanceResult.Unavailable("Invalid TRON address.")
        val contractHex = tronAddressToHex(token.contract)
            ?: return BalanceResult.Unavailable("Invalid TRON token contract address.")
        val parameter = ownerHex.removePrefix("41").padStart(64, '0')
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val body = buildJsonObject {
                    put("owner_address", ownerHex)
                    put("contract_address", contractHex)
                    put("function_selector", "balanceOf(address)")
                    put("parameter", parameter)
                    put("visible", false)
                }.toString()
                val text = transport.postJsonText("$base/wallet/triggerconstantcontract", body)
                val root = parseJsonObject(text)
                if (root == null) {
                    lastError = "unexpected response shape from $base"
                    continue
                }
                val resultObj = root.objectField("result")
                // TronGrid answers result: { result: true } (boolean).
                val resultOk = try {
                    resultObj?.get("result")?.jsonPrimitive?.content == "true"
                } catch (e: Exception) {
                    false
                }
                val constant = try {
                    root["constant_result"]?.jsonArray
                } catch (e: Exception) {
                    null
                }
                if (!resultOk || constant == null || constant.isEmpty()) {
                    lastError = "unexpected response shape from $base"
                    continue
                }
                val hex = constant[0].jsonPrimitive.content
                val raw = hexToBigInteger(hex)
                if (raw == null) {
                    lastError = "unexpected response shape from $base"
                    continue
                }
                return BalanceResult.Available(raw.toString(), token.decimals)
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        return BalanceResult.Unavailable(
            "All TRON endpoints failed; no ${token.symbol} balance could be read." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    // --- Shared JSON-RPC sweep -------------------------------------------

    /**
     * One JSON-RPC call swept across [endpoints] in order; the first
     * endpoint that answers HTTP 200 with a result (and no error) wins.
     * Returns the raw result element, or null when every endpoint failed.
     */
    private suspend fun sweepJsonRpc(
        endpoints: List<String>,
        method: String,
        params: JsonArray
    ): JsonElement? {
        for (base in endpoints) {
            try {
                return jsonRpcCall(base, method, params)
            } catch (e: Exception) {
                continue
            }
        }
        return null
    }

    private suspend fun sweepEthCall(
        endpoints: List<String>,
        to: String,
        data: String
    ): JsonElement? {
        val params = buildJsonArray {
            add(buildJsonObject {
                put("to", to)
                put("data", data)
            })
            add(JsonPrimitive("latest"))
        }
        return sweepJsonRpc(endpoints, "eth_call", params)
    }

    private suspend fun jsonRpcCall(
        url: String,
        method: String,
        params: JsonElement
    ): JsonElement {
        val body = buildJsonObject {
            put("jsonrpc", "2.0")
            put("id", 1)
            put("method", method)
            put("params", params)
        }.toString()
        val text = transport.postJsonText(url, body)
        val root = parseJsonObject(text)
            ?: throw IllegalStateException("Invalid RPC response from $url")
        val error = root["error"]
        if (error != null) {
            val message = try {
                error.jsonObject.stringField("message") ?: "RPC error"
            } catch (e: Exception) {
                "RPC error"
            }
            throw IllegalStateException(message)
        }
        return root["result"]
            ?: throw IllegalStateException("Invalid RPC response from $url")
    }

    companion object {
        const val TONAPI_BASE_URL = "https://tonapi.io"
        const val SOCHAIN_BASE = "https://sochain.com/api/v3"
        const val BLOCKCYPHER_DOGE_BASE = "https://api.blockcypher.com/v1/doge/main"

        /** ERC-20 balanceOf(address) selector. */
        const val BALANCE_OF_SELECTOR = "0x70a08231"

        fun isTronAddress(address: String): Boolean {
            if (address.length != 34 || !address.startsWith("T")) return false
            return address.all { it in "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz" }
        }

        fun isTonAddress(address: String): Boolean {
            if (address.length != 48) return false
            return address.startsWith("EQ") || address.startsWith("UQ")
        }

        /**
         * TRON base58 address to hex (0x41 + 20 bytes, 50 hex chars),
         * or null when the address is not a well-formed TRON address.
         */
        fun tronAddressToHex(address: String): String? {
            if (!isTronAddress(address)) return null
            val hex = base58ToHex(address) ?: return null
            if (hex.length != 50 || !hex.startsWith("41")) return null
            return hex
        }
    }
}
