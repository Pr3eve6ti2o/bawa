package com.bawa.wallet.core

import com.google.protobuf.ByteString
import wallet.core.jni.proto.Ethereum
import java.math.BigInteger

/**
 * Sepolia native-ETH send composer (pure proto assembly, no network,
 * no secrets). The caller fetches [nonce], fees, and [gasLimit] from
 * the Sepolia adapter; the engine injects the private key at sign
 * time. This composer builds ONLY native transfers — no ERC20, no
 * contract calls, no data payload.
 *
 * Field mapping verified against src/proto/Ethereum.proto at 4.8.4:
 * chain_id (1), nonce (2), tx_mode Enveloped (1), max_inclusion_fee
 * (6), max_fee_per_gas (7), to_address (8), private_key (9, engine),
 * transaction.transfer.amount (10/1). All uint256 values are
 * big-endian; zero encodes as empty bytes.
 *
 * Like CoreWalletEngine, this file compiles only with the
 * wallet-core-proto JAR on the classpath.
 */
object EthSendComposer {

    data class Params(
        val chainId: Long,
        val nonce: BigInteger,
        val maxFeePerGasWei: BigInteger,
        val maxPriorityFeePerGasWei: BigInteger,
        val gasLimit: BigInteger,
        val toAddress: String,
        val amountWei: BigInteger,
    )

    fun compose(params: Params): Result<ByteArray> {
        if (!Validation.isValidEth(params.toAddress)) {
            return Result.failure(EngineError.InvalidAddress("Recipient is not a valid Ethereum address"))
        }
        if (params.amountWei < BigInteger.ZERO || params.gasLimit <= BigInteger.ZERO) {
            return Result.failure(EngineError.SigningRefused("Amount or gas limit is invalid"))
        }
        val input = Ethereum.SigningInput.newBuilder()
            .setChainId(uint256(params.chainId.toBigInteger()))
            .setNonce(uint256(params.nonce))
            .setTxMode(Ethereum.TransactionMode.Enveloped)
            .setMaxInclusionFeePerGas(uint256(params.maxPriorityFeePerGasWei))
            .setMaxFeePerGas(uint256(params.maxFeePerGasWei))
            .setGasLimit(uint256(params.gasLimit))
            .setToAddress(params.toAddress)
            .setTransaction(
                Ethereum.Transaction.newBuilder()
                    .setTransfer(
                        Ethereum.Transaction.Transfer.newBuilder()
                            .setAmount(uint256(params.amountWei))
                            .build(),
                    )
                    .build(),
            )
            .build()
        return Result.success(input.toByteArray())
    }

    private fun uint256(value: BigInteger): ByteString {
        if (value == BigInteger.ZERO) return ByteString.EMPTY
        var bytes = value.toByteArray()
        if (bytes.isNotEmpty() && bytes[0] == 0.toByte()) bytes = bytes.copyOfRange(1, bytes.size)
        return ByteString.copyFrom(bytes)
    }

    private fun Long.toBigInteger(): BigInteger = BigInteger.valueOf(this)
}
