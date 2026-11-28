package com.bawa.wallet.data

import kotlinx.coroutines.delay
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

// Live transaction history (Step 5, Lane B). Mirrors the web's history
// sources (apps/web/src/wallet/chains.ts + adapters/evm.ts, sol.ts,
// trx.ts, ton.ts, btc.ts, ltc.ts, doge.ts):
//  - EVM: the 12 chains whose keyless indexer the web probed live —
//    Blockscout txlist (eth, matic, arb, op, base, celo, scroll,
//    aurora), Etherscan V2 keyless (linea), gnosisscan.io (gnosis),
//    Routescan (avax, mantle). Every other EVM chain answers
//    Unavailable: no keyless indexer covers it.
//  - SOL: getSignaturesForAddress (confirmationStatus distinguishes
//    Pending / Included / Confirmed; err marks Failed).
//  - TRX: Trongrid account transactions, TronScan as fallback.
//  - TON: TonCenter getTransactions.
//  - BTC/LTC: Esplora /address/{address}/txs.
//  - DOGE: SoChain in+out, BlockCypher as fallback.
// The five statuses stay distinct; nothing is merged and nothing is
// invented. lookup() resolves one hash through the same source (for
// EVM chains, through the RPC: receipt present -> Confirmed/Failed,
// transaction without receipt -> Pending). Read-only throughout.

class LiveHistoryRepository(
    private val registry: ChainRegistry,
    private val transport: HttpTransport = OkHttpTransport(),
    /** Delay before retrying an Etherscan V2 quota hit (1 request / 5 s per IP). Tests pass 0. */
    private val etherscanRetryDelayMs: Long = 6000
) : HistoryRepository {

    override suspend fun history(chainId: String, address: String): HistoryResult {
        val chain = registry.chainById(chainId)
            ?: return HistoryResult.Unavailable(
                "Unknown chain \"$chainId\": no history source is configured."
            )
        return try {
            when (chainId) {
                "sol" -> solHistory(chain, address)
                "trx" -> tronHistory(chain, address)
                "ton" -> tonHistory(chain, address)
                "btc", "ltc" -> esploraHistory(chain, address)
                "doge" -> dogeHistory(chain, address)
                else -> if (chain.evmChainId != null) {
                    evmHistory(chain, address)
                } else {
                    HistoryResult.Unavailable(
                        "History is not connected for ${chain.name} yet — " +
                            "no keyless indexer covers this chain, so only the balance shows here."
                    )
                }
            }
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "History lookup failed for ${chain.name}: ${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    override suspend fun lookup(chainId: String, txHash: String): HistoryResult {
        val chain = registry.chainById(chainId)
            ?: return HistoryResult.Unavailable(
                "Unknown chain \"$chainId\": no history source is configured."
            )
        return try {
            when (chainId) {
                "sol" -> solLookup(chain, txHash)
                "trx" -> tronLookup(chain, txHash)
                "ton" -> HistoryResult.Unavailable(
                    "Transaction lookup by hash is not available for TON yet."
                )
                "btc", "ltc" -> esploraLookup(chain, txHash)
                "doge" -> dogeLookup(chain, txHash)
                else -> if (chain.evmChainId != null) {
                    evmLookup(chain, txHash)
                } else {
                    HistoryResult.Unavailable(
                        "History is not connected for ${chain.name} yet — " +
                            "no keyless indexer covers this chain."
                    )
                }
            }
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "Transaction lookup failed for ${chain.name}: ${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    // --- EVM (Etherscan-family txlist) -----------------------------------

    private suspend fun evmHistory(chain: ChainRecord, address: String): HistoryResult {
        if (!isEvmAddress(address)) {
            return HistoryResult.Unavailable("Invalid Ethereum address.")
        }
        val source = EVM_HISTORY_SOURCES[chain.id]
            ?: return HistoryResult.Unavailable(
                "History is not connected for ${chain.name} yet — no keyless " +
                    "indexer covers this chain, so only the balance shows here."
            )
        val (baseUrl, explorerBase) = source
        val separator = if (baseUrl.contains("?")) "&" else "?"
        val url = "$baseUrl${separator}module=account&action=txlist" +
            "&address=$address&page=1&offset=20&sort=desc"
        val isEtherscanV2 = baseUrl.contains("api.etherscan.io/v2")
        var raw: JsonObject? = null
        var attempts = 0
        while (true) {
            attempts++
            val text = try {
                transport.get(url)
            } catch (e: Exception) {
                return HistoryResult.Unavailable(
                    "History request failed for ${chain.name}: " +
                        (e.message ?: e.javaClass.simpleName)
                )
            }
            raw = parseJsonObject(text)
                ?: return HistoryResult.Unavailable(
                    "The history answer for ${chain.name} was not valid JSON."
                )
            // Etherscan V2's keyless tier allows 1 request / 5 s per IP
            // and answers NOTOK "Missing/Invalid API Key" inside the
            // window — the same message as a missing key. One retry
            // after the window clears it; a second NOTOK is the error.
            val quotaHit = isEtherscanV2 && attempts == 1 &&
                raw.stringField("status") != "1" &&
                ((raw.stringField("message")?.contains("Missing/Invalid API Key") == true) ||
                    (raw.stringField("result")?.contains("Missing/Invalid API Key") == true))
            if (!quotaHit) break
            if (etherscanRetryDelayMs > 0) delay(etherscanRetryDelayMs)
        }
        val root = raw ?: return HistoryResult.Unavailable(
            "The history answer for ${chain.name} was not valid JSON."
        )
        if (root.stringField("status") != "1") {
            val message = root.stringField("message") ?: ""
            if (message.contains("No transactions found")) {
                return HistoryResult.Available(emptyList())
            }
            return HistoryResult.Unavailable(
                "History request failed for ${chain.name}: ${message.ifEmpty { "indexer error" }}"
            )
        }
        val entries = try {
            root["result"]?.jsonArray
        } catch (e: Exception) {
            null
        } ?: return HistoryResult.Unavailable(
            "The history answer for ${chain.name} was not a transaction list."
        )
        val txs = entries.mapNotNull { entry ->
            try {
                val obj = entry.jsonObject
                val hash = obj.stringField("hash") ?: return@mapNotNull null
                val failed = obj.stringField("txreceipt_status") == "0" ||
                    obj.stringField("isError") == "1"
                TransactionRecord(
                    hash = hash,
                    chainId = chain.id,
                    status = if (failed) TransactionStatus.Failed else TransactionStatus.Confirmed,
                    explorerUrl = explorerBase?.let { "$it/tx/$hash" }
                )
            } catch (e: Exception) {
                null
            }
        }
        return HistoryResult.Available(txs)
    }

    private suspend fun evmLookup(chain: ChainRecord, txHash: String): HistoryResult {
        if (!txHash.startsWith("0x") || txHash.length != 66) {
            return HistoryResult.Unavailable("Invalid transaction hash.")
        }
        val explorerBase = EVM_HISTORY_SOURCES[chain.id]?.second
        val explorerUrl = explorerBase?.let { "$it/tx/$txHash" }
        // Receipt present -> Confirmed/Failed; transaction without a
        // receipt -> still pending in the mempool.
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val tx = jsonRpcCall(base, "eth_getTransactionByHash", buildJsonArray {
                    add(JsonPrimitive(txHash))
                })
                // A JSON null result means "not found" on this endpoint;
                // keep sweeping rather than reporting it.
                if (tx.toString() == "null") continue
                val receipt = jsonRpcCall(base, "eth_getTransactionReceipt", buildJsonArray {
                    add(JsonPrimitive(txHash))
                })
                if (receipt.toString() == "null") {
                    return HistoryResult.Available(
                        listOf(
                            TransactionRecord(txHash, chain.id, TransactionStatus.Pending, explorerUrl)
                        )
                    )
                }
                val statusHex = try {
                    receipt.jsonObject.stringField("status")
                } catch (e: Exception) {
                    null
                }
                val status = if (statusHex == "0x0") {
                    TransactionStatus.Failed
                } else {
                    TransactionStatus.Confirmed
                }
                return HistoryResult.Available(
                    listOf(TransactionRecord(txHash, chain.id, status, explorerUrl))
                )
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        return HistoryResult.Unavailable(
            "Transaction not found on ${chain.name}." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    // --- Solana ------------------------------------------------------------

    private suspend fun solHistory(chain: ChainRecord, address: String): HistoryResult {
        val signatures = solSignatures(chain, address)
            ?: return HistoryResult.Unavailable(
                "All RPC endpoints failed for ${chain.name}; no history could be read."
            )
        val txs = signatures.mapNotNull { entry ->
            try {
                val obj = entry.jsonObject
                val signature = obj.stringField("signature") ?: return@mapNotNull null
                val hasError = obj["err"] != null && obj["err"].toString() != "null"
                val confirmation = obj.stringField("confirmationStatus")
                val status = when {
                    hasError -> TransactionStatus.Failed
                    confirmation == "finalized" -> TransactionStatus.Confirmed
                    confirmation == "confirmed" -> TransactionStatus.Included
                    confirmation == "processed" -> TransactionStatus.Pending
                    else -> TransactionStatus.Confirmed
                }
                TransactionRecord(
                    hash = signature,
                    chainId = chain.id,
                    status = status,
                    explorerUrl = "https://explorer.solana.com/tx/$signature"
                )
            } catch (e: Exception) {
                null
            }
        }
        return HistoryResult.Available(txs)
    }

    private suspend fun solLookup(chain: ChainRecord, txHash: String): HistoryResult {
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val result = jsonRpcCall(
                    base,
                    "getTransaction",
                    buildJsonArray {
                        add(JsonPrimitive(txHash))
                        add(buildJsonObject {
                            put("encoding", "jsonParsed")
                            put("maxSupportedTransactionVersion", 0)
                        })
                    }
                )
                if (result.toString() == "null") {
                    return HistoryResult.Unavailable(
                        "Transaction not found on ${chain.name}."
                    )
                }
                val meta = try {
                    result.jsonObject.objectField("meta")
                } catch (e: Exception) {
                    null
                }
                val failed = meta != null &&
                    meta["err"] != null && meta["err"].toString() != "null"
                val status = if (failed) TransactionStatus.Failed else TransactionStatus.Confirmed
                return HistoryResult.Available(
                    listOf(
                        TransactionRecord(
                            txHash,
                            chain.id,
                            status,
                            "https://explorer.solana.com/tx/$txHash"
                        )
                    )
                )
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        return HistoryResult.Unavailable(
            "Transaction not found on ${chain.name}." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    private suspend fun solSignatures(chain: ChainRecord, address: String): JsonArray? {
        for (base in chain.rpcEndpoints) {
            try {
                val result = jsonRpcCall(
                    base,
                    "getSignaturesForAddress",
                    buildJsonArray {
                        add(JsonPrimitive(address))
                        add(buildJsonObject { put("limit", 20) })
                    }
                )
                return try {
                    result.jsonArray
                } catch (e: Exception) {
                    null
                } ?: continue
            } catch (e: Exception) {
                continue
            }
        }
        return null
    }

    // --- TRON --------------------------------------------------------------

    private suspend fun tronHistory(chain: ChainRecord, address: String): HistoryResult {
        // Trongrid first; TronScan as the fallback (the web's order).
        try {
            val text = transport.get(
                "https://api.trongrid.io/v1/accounts/$address/transactions" +
                    "?limit=20&order_by=block_timestamp,desc"
            )
            val data = parseJsonObject(text)?.let {
                try {
                    it["data"]?.jsonArray
                } catch (e: Exception) {
                    null
                }
            }
            if (data != null) {
                return HistoryResult.Available(data.mapNotNull { entry ->
                    try {
                        val obj = entry.jsonObject
                        val hash = obj.stringField("txID") ?: return@mapNotNull null
                        val ret = try {
                            obj["ret"]?.jsonArray?.firstOrNull()?.jsonObject
                        } catch (e: Exception) {
                            null
                        }
                        val contractRet = ret?.stringField("contractRet")
                        TransactionRecord(
                            hash = hash,
                            chainId = chain.id,
                            status = if (contractRet == "SUCCESS") {
                                TransactionStatus.Confirmed
                            } else {
                                TransactionStatus.Failed
                            },
                            explorerUrl = "https://tronscan.org/#/transaction/$hash"
                        )
                    } catch (e: Exception) {
                        null
                    }
                })
            }
        } catch (e: Exception) {
            // Fall through to TronScan.
        }
        return try {
            val text = transport.get(
                "https://apilist.tronscanapi.com/api/transaction" +
                    "?sort=-timestamp&limit=20&address=$address"
            )
            val data = parseJsonObject(text)?.let {
                try {
                    it["data"]?.jsonArray
                } catch (e: Exception) {
                    null
                }
            } ?: return HistoryResult.Unavailable(
                "All TRON history endpoints failed; no history could be read."
            )
            HistoryResult.Available(data.mapNotNull { entry ->
                try {
                    val obj = entry.jsonObject
                    val hash = obj.stringField("hash") ?: return@mapNotNull null
                    val contractRet = obj.stringField("contractRet")
                    TransactionRecord(
                        hash = hash,
                        chainId = chain.id,
                        status = if (contractRet == "SUCCESS") {
                            TransactionStatus.Confirmed
                        } else {
                            TransactionStatus.Failed
                        },
                        explorerUrl = "https://tronscan.org/#/transaction/$hash"
                    )
                } catch (e: Exception) {
                    null
                }
            })
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "All TRON history endpoints failed; no history could be read. " +
                    "Last error: ${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    private suspend fun tronLookup(chain: ChainRecord, txHash: String): HistoryResult {
        return try {
            val text = transport.get("https://api.trongrid.io/v1/transactions/$txHash")
            val data = parseJsonObject(text)?.let {
                try {
                    it["data"]?.jsonArray
                } catch (e: Exception) {
                    null
                }
            }
            if (data == null || data.isEmpty()) {
                return HistoryResult.Unavailable(
                    "Transaction not found on ${chain.name}."
                )
            }
            val obj = data[0].jsonObject
            val ret = try {
                obj["ret"]?.jsonArray?.firstOrNull()?.jsonObject
            } catch (e: Exception) {
                null
            }
            val status = if (ret?.stringField("contractRet") == "SUCCESS") {
                TransactionStatus.Confirmed
            } else {
                TransactionStatus.Failed
            }
            HistoryResult.Available(
                listOf(
                    TransactionRecord(
                        txHash,
                        chain.id,
                        status,
                        "https://tronscan.org/#/transaction/$txHash"
                    )
                )
            )
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "Transaction lookup failed for ${chain.name}: " +
                    (e.message ?: e.javaClass.simpleName)
            )
        }
    }

    // --- TON ---------------------------------------------------------------

    private suspend fun tonHistory(chain: ChainRecord, address: String): HistoryResult {
        val base = chain.rpcEndpoints.firstOrNull()
            ?: return HistoryResult.Unavailable(
                "No TON endpoint is configured; no history could be read."
            )
        return try {
            val result = jsonRpcCall(base, "getTransactions", buildJsonObject {
                put("address", address)
                put("limit", 20)
            })
            val list = try {
                result.jsonArray
            } catch (e: Exception) {
                null
            } ?: return HistoryResult.Unavailable(
                "The TON history answer was not a transaction list."
            )
            HistoryResult.Available(list.mapNotNull { entry ->
                try {
                    val obj = entry.jsonObject
                    val txId = obj.objectField("transaction_id") ?: return@mapNotNull null
                    val hashBase64 = txId.stringField("hash") ?: return@mapNotNull null
                    val hashHex = base64ToHex(hashBase64) ?: return@mapNotNull null
                    // TonCenter getTransactions only returns transactions
                    // already on chain.
                    TransactionRecord(
                        hash = hashHex,
                        chainId = chain.id,
                        status = TransactionStatus.Confirmed,
                        explorerUrl = "https://tonviewer.com/transaction/$hashHex"
                    )
                } catch (e: Exception) {
                    null
                }
            })
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "History request failed for ${chain.name}: " +
                    (e.message ?: e.javaClass.simpleName)
            )
        }
    }

    // --- BTC / LTC (Esplora) ------------------------------------------------

    private suspend fun esploraHistory(chain: ChainRecord, address: String): HistoryResult {
        var lastError: String? = null
        for (base in chain.rpcEndpoints) {
            try {
                val text = transport.get("$base/address/$address/txs")
                val list = parseJsonElement(text)?.let {
                    try {
                        it.jsonArray
                    } catch (e: Exception) {
                        null
                    }
                }
                if (list == null) {
                    lastError = "unexpected response shape from $base"
                    continue
                }
                val explorerBase = if (chain.id == "btc") {
                    "https://mempool.space"
                } else {
                    "https://litecoinspace.org"
                }
                return HistoryResult.Available(list.mapNotNull { entry ->
                    try {
                        val obj = entry.jsonObject
                        val txid = obj.stringField("txid") ?: return@mapNotNull null
                        val confirmed = obj.objectField("status")
                            ?.let {
                                try {
                                    it["confirmed"]?.jsonPrimitive?.content == "true"
                                } catch (e: Exception) {
                                    false
                                }
                            } ?: false
                        TransactionRecord(
                            hash = txid,
                            chainId = chain.id,
                            status = if (confirmed) {
                                TransactionStatus.Confirmed
                            } else {
                                TransactionStatus.Pending
                            },
                            explorerUrl = "$explorerBase/tx/$txid"
                        )
                    } catch (e: Exception) {
                        null
                    }
                })
            } catch (e: Exception) {
                lastError = "${e.message ?: e.javaClass.simpleName} ($base)"
            }
        }
        return HistoryResult.Unavailable(
            "All ${chain.name} history endpoints failed; no history could be read." +
                (lastError?.let { " Last error: $it" } ?: "")
        )
    }

    private suspend fun esploraLookup(chain: ChainRecord, txHash: String): HistoryResult {
        val explorerBase = if (chain.id == "btc") {
            "https://mempool.space"
        } else {
            "https://litecoinspace.org"
        }
        for (base in chain.rpcEndpoints) {
            try {
                val text = transport.get("$base/tx/$txHash")
                val obj = parseJsonObject(text)
                    ?: return HistoryResult.Unavailable(
                        "The ${chain.name} answer was not a transaction."
                    )
                val confirmed = obj.objectField("status")?.let {
                    try {
                        it["confirmed"]?.jsonPrimitive?.content == "true"
                    } catch (e: Exception) {
                        false
                    }
                } ?: false
                return HistoryResult.Available(
                    listOf(
                        TransactionRecord(
                            txHash,
                            chain.id,
                            if (confirmed) TransactionStatus.Confirmed else TransactionStatus.Pending,
                            "$explorerBase/tx/$txHash"
                        )
                    )
                )
            } catch (e: Exception) {
                if (e is HttpStatusException && e.statusCode == 404) {
                    return HistoryResult.Unavailable(
                        "Transaction not found on ${chain.name}."
                    )
                }
                continue
            }
        }
        return HistoryResult.Unavailable(
            "Transaction not found on ${chain.name}."
        )
    }

    // --- DOGE ---------------------------------------------------------------

    private suspend fun dogeHistory(chain: ChainRecord, address: String): HistoryResult {
        try {
            val inText = transport.get(
                "${LiveBalanceRepository.SOCHAIN_BASE}/transactions/DOGE/$address?direction=in"
            )
            val outText = transport.get(
                "${LiveBalanceRepository.SOCHAIN_BASE}/transactions/DOGE/$address?direction=out"
            )
            val inTxs = parseSochainTxs(inText, chain.id)
            val outTxs = parseSochainTxs(outText, chain.id)
            if (inTxs != null && outTxs != null) {
                return HistoryResult.Available(inTxs + outTxs)
            }
        } catch (e: Exception) {
            // Fall through to BlockCypher.
        }
        return try {
            val text = transport.get(
                "${LiveBalanceRepository.BLOCKCYPHER_DOGE_BASE}/addrs/$address/full?limit=20"
            )
            val txs = parseJsonObject(text)?.let {
                try {
                    it["txs"]?.jsonArray
                } catch (e: Exception) {
                    null
                }
            } ?: return HistoryResult.Unavailable(
                "All Dogecoin history endpoints failed; no history could be read."
            )
            HistoryResult.Available(txs.mapNotNull { entry ->
                try {
                    val obj = entry.jsonObject
                    val hash = obj.stringField("hash") ?: return@mapNotNull null
                    val confirmations = obj.numberStringField("confirmations")
                        ?.toLongOrNull() ?: 0L
                    TransactionRecord(
                        hash = hash,
                        chainId = chain.id,
                        status = if (confirmations > 0) {
                            TransactionStatus.Confirmed
                        } else {
                            TransactionStatus.Pending
                        },
                        explorerUrl = "https://live.blockcypher.com/doge/tx/$hash"
                    )
                } catch (e: Exception) {
                    null
                }
            })
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "All Dogecoin history endpoints failed; no history could be read. " +
                    "Last error: ${e.message ?: e.javaClass.simpleName}"
            )
        }
    }

    private fun parseSochainTxs(text: String, chainId: String): List<TransactionRecord>? {
        val root = parseJsonObject(text) ?: return null
        if (root.stringField("status") != "success") return null
        val txs = root.objectField("data")?.let {
            try {
                it["transactions"]?.jsonArray
            } catch (e: Exception) {
                null
            }
        } ?: return null
        return txs.mapNotNull { entry ->
            try {
                val obj = entry.jsonObject
                val hash = obj.stringField("hash") ?: return@mapNotNull null
                // SoChain lists confirmed transactions only.
                TransactionRecord(
                    hash = hash,
                    chainId = chainId,
                    status = TransactionStatus.Confirmed,
                    explorerUrl = "https://dogechain.info/tx/$hash"
                )
            } catch (e: Exception) {
                null
            }
        }
    }

    private suspend fun dogeLookup(chain: ChainRecord, txHash: String): HistoryResult {
        try {
            val text = transport.get(
                "${LiveBalanceRepository.SOCHAIN_BASE}/transaction/DOGE/$txHash"
            )
            val data = parseJsonObject(text)?.objectField("data")
            if (parseJsonObject(text)?.stringField("status") == "success" && data != null) {
                val confirmations = data.numberStringField("confirmations")
                    ?.toLongOrNull() ?: 0L
                return HistoryResult.Available(
                    listOf(
                        TransactionRecord(
                            txHash,
                            chain.id,
                            if (confirmations > 0) {
                                TransactionStatus.Confirmed
                            } else {
                                TransactionStatus.Pending
                            },
                            "https://dogechain.info/tx/$txHash"
                        )
                    )
                )
            }
        } catch (e: Exception) {
            // Fall through to BlockCypher.
        }
        return try {
            val text = transport.get(
                "${LiveBalanceRepository.BLOCKCYPHER_DOGE_BASE}/txs/$txHash"
            )
            val obj = parseJsonObject(text)
                ?: return HistoryResult.Unavailable(
                    "Transaction not found on ${chain.name}."
                )
            val confirmations = obj.numberStringField("confirmations")
                ?.toLongOrNull() ?: 0L
            HistoryResult.Available(
                listOf(
                    TransactionRecord(
                        txHash,
                        chain.id,
                        if (confirmations > 0) {
                            TransactionStatus.Confirmed
                        } else {
                            TransactionStatus.Pending
                        },
                        "https://live.blockcypher.com/doge/tx/$txHash"
                    )
                )
            )
        } catch (e: Exception) {
            HistoryResult.Unavailable(
                "Transaction not found on ${chain.name}."
            )
        }
    }

    // --- Shared JSON-RPC ----------------------------------------------------

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
        val text = transport.postJson(url, body)
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
        /**
         * Keyless EVM history sources, probed live by the web
         * (apps/web/src/wallet/chains.ts): base URL + explorer base.
         * Linea's base already carries ?chainid=59144, so the txlist
         * params join with '&' there. Chains not listed here have no
         * keyless indexer and answer Unavailable.
         */
        val EVM_HISTORY_SOURCES: Map<String, Pair<String, String?>> = mapOf(
            "eth" to ("https://eth.blockscout.com/api" to "https://eth.blockscout.com"),
            "matic" to ("https://polygon.blockscout.com/api" to "https://polygon.blockscout.com"),
            "arb" to ("https://arbitrum.blockscout.com/api" to "https://arbitrum.blockscout.com"),
            "op" to ("https://explorer.optimism.io/api" to "https://explorer.optimism.io"),
            "base" to ("https://base.blockscout.com/api" to "https://base.blockscout.com"),
            "avax" to ("https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan/api" to null),
            "gnosis" to ("https://gnosisscan.io/api" to "https://gnosisscan.io"),
            "celo" to ("https://celo.blockscout.com/api" to "https://celo.blockscout.com"),
            "linea" to ("https://api.etherscan.io/v2/api?chainid=59144" to "https://lineascan.build"),
            "mantle" to ("https://api.routescan.io/v2/network/mainnet/evm/5000/etherscan/api" to null),
            "scroll" to ("https://scrollscan.com/api" to "https://scrollscan.com"),
            "aurora" to ("https://explorer.aurora.dev/api" to "https://explorer.aurora.dev")
        )
    }
}
