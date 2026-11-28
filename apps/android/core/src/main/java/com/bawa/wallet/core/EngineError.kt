package com.bawa.wallet.core

/**
 * Typed engine errors (docs 14 §5.4). Messages are safe to display:
 * they never contain secrets, phrases, keys, or raw exception payloads.
 * Callers must pass messages through Redaction before logging.
 */
sealed class EngineError(message: String) : Exception(message) {
    class UnsupportedChain(message: String) : EngineError(message)
    class InvalidIndex(message: String) : EngineError(message)
    class EmptyXpub(message: String) : EngineError(message)
    class XpubTooLong(message: String) : EngineError(message)
    class PrivateExtendedKey(message: String) : EngineError(message)
    class MalformedXpub(message: String) : EngineError(message)
    class CoreInitialisationFailed(message: String) : EngineError(message)
    class PublicDerivationFailed(message: String) : EngineError(message)
    class AddressDerivationFailed(message: String) : EngineError(message)
    class AddressValidationFailed(message: String) : EngineError(message)
    class FixtureGateFailed(message: String) : EngineError(message)
    class InvalidMnemonic(message: String) : EngineError(message)
    class InvalidPassphrasePolicy(message: String) : EngineError(message)
    class VaultLocked(message: String) : EngineError(message)
    class VaultAuthenticationFailed(message: String) : EngineError(message)
    class VaultUnavailable(message: String) : EngineError(message)
    class InvalidTonConfig(message: String) : EngineError(message)
    class SigningRefused(message: String) : EngineError(message)
    class NetworkError(message: String) : EngineError(message)
    class InvalidAddress(message: String) : EngineError(message)
    class InsufficientFunds(message: String) : EngineError(message)
}
