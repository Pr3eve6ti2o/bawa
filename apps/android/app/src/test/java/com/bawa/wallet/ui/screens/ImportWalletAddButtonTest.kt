package com.bawa.wallet.ui.screens

import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import com.bawa.wallet.MainActivity
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Robolectric Compose test for the Import screen's Add button: the real app activity,
 * the real navigation (Welcome -> Import), a real click on the real Add button,
 * asserting the real UI outcome. This is the JVM-verifiable form of the on-device
 * Add-button check (T22): the emulator/device run remains blocked (see
 * docs/android-evidence.md and the T22 report).
 *
 * Note: createComposeRule() cannot be used here — under Robolectric it fails to
 * resolve androidx.activity.ComponentActivity (robolectric/robolectric#4736), even
 * with ui-test-manifest on the classpath. Launching the real MainActivity avoids it.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class ImportWalletAddButtonTest {
    @get:Rule
    val composeRule = createAndroidComposeRule<MainActivity>()

    private val ethXpub =
        "xpub6BsRBaXawwf5vGydzpBSDXrQJ5rZKrZQGPTWkXRTWXz1KZ11D8TixEwX3uBWHwZE1DzQJuyLT9hgZcp4bFKfYNCx5cYCYBQqP5jbxcVQumc"

    private fun openImportScreen() {
        composeRule.onNodeWithText("Import a watch-only wallet").performClick()
        composeRule.onNodeWithText("Import a watch-only wallet").assertIsDisplayed()
    }

    @Test
    fun validAddShowsSuccessAndListsWallet() {
        openImportScreen()

        composeRule.onNodeWithText("ETH").performClick()
        composeRule.onNodeWithText("Extended public key (xpub)").performTextInput(ethXpub)
        composeRule.onNodeWithText("Label (optional)").performTextInput("My ETH")
        // The Add button sits below the fold in the 320x470 test viewport: scroll it into
        // view first, or the tap lands outside the window and is dropped silently.
        composeRule.onNodeWithText("Add").performScrollTo().performClick()

        composeRule.onNodeWithText("Watch-only wallet added for ETH.").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("ETH — My ETH").performScrollTo().assertIsDisplayed()
        // Both fields are cleared on success: the typed values are gone from the UI.
        composeRule.onAllNodesWithText(ethXpub).assertCountEquals(0)
        composeRule.onAllNodesWithText("My ETH").assertCountEquals(0)
    }

    @Test
    fun invalidAddShowsErrorAndAddsNothing() {
        openImportScreen()
        val corrupted = ethXpub.dropLast(1) + "1"

        composeRule.onNodeWithText("ETH").performClick()
        composeRule.onNodeWithText("Extended public key (xpub)").performTextInput(corrupted)
        composeRule.onNodeWithText("Add").performScrollTo().performClick()

        composeRule.onNodeWithText("invalid extended key checksum").performScrollTo().assertIsDisplayed()
        composeRule.onNodeWithText("No watch-only wallets imported yet.").performScrollTo().assertIsDisplayed()
        composeRule.onAllNodesWithText("Watch-only wallet added for ETH.").assertCountEquals(0)
    }

    @Test
    fun chainSelectionIsShown() {
        openImportScreen()

        composeRule.onNodeWithText("ETH").performClick()

        composeRule.onNodeWithText("Selected chain: ETH").assertIsDisplayed()
    }
}
