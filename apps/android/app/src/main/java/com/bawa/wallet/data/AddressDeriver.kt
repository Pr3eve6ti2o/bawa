package com.bawa.wallet.data

import com.bawa.wallet.core.Chain
import com.bawa.wallet.core.WalletEngine

// Watch-only address derivation (Step 6). The ViewModel holds extended
// public keys; the live balance/history repositories need addresses.
// Derivation runs through the Trust Wallet Core engine (Step 4 AAR),
// behind this small interface so the ViewModel stays unit-testable on
// the JVM without the native library: tests inject a fake, production
// injects [CoreAddressDeriver]. Derivation is index 0 only — the
// first receiving address of the imported account.

sealed interface DerivedAddressResult {
    data class Available(val address: String, val path: String) : DerivedAddressResult
    data class Unavailable(val reason: String) : DerivedAddressResult
}

fun interface AddressDeriver {
    fun deriveAddress(chain: Chain, xpub: String, index: Int): DerivedAddressResult
}

/**
 * [AddressDeriver] over the [WalletEngine]. The engine's fixture gate
 * runs lazily once, on the first derivation (on the caller's
 * background thread — never on the UI thread, and never at app
 * startup, where it would block launch). A gate that fails, or an
 * engine that cannot initialise, makes every derivation Unavailable
 * with the reason — the app stays usable, it never crashes, and no
 * balance or history is ever fetched for an address that was not
 * really derived. TON has no xpub, so the engine refuses it and the
 * answer is Unavailable, never an invented address.
 */
class CoreAddressDeriver(private val engine: WalletEngine) : AddressDeriver {

    @Volatile
    private var gateChecked = false

    @Volatile
    private var gateOk = false

    override fun deriveAddress(chain: Chain, xpub: String, index: Int): DerivedAddressResult {
        if (!gateChecked) {
            gateOk = try {
                engine.runFixtureGate().isSuccess
            } catch (e: Exception) {
                false
            }
            gateChecked = true
        }
        if (!gateOk) {
            return DerivedAddressResult.Unavailable(
                "On-device fixture gate did not pass, so no address can be derived on this device."
            )
        }
        return engine.deriveAddress(chain, xpub, index).fold(
            onSuccess = { DerivedAddressResult.Available(it.address, it.fullPath) },
            onFailure = {
                DerivedAddressResult.Unavailable(
                    it.message ?: "Address derivation failed."
                )
            }
        )
    }
}
