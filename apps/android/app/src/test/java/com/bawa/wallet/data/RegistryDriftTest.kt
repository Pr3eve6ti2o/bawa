package com.bawa.wallet.data

import java.io.File
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Drift gate: the bundled copies under src/main/assets/ must stay
 * byte-identical to their canonical sources. Regenerate by copying
 * (see apps/android/DATA-LAYER.md) — never hand-edit a copy.
 *
 * Paths are resolved from the repository root, found by walking up
 * from the test working directory (Gradle runs unit tests with the
 * working directory at the app module, but that is not guaranteed).
 */
class RegistryDriftTest {

    /** Repository root: the first ancestor (or the cwd itself) that holds registry/chains.json. */
    private fun repoRoot(): File {
        var dir: File? = File(".").absoluteFile
        while (dir != null) {
            if (File(dir, "registry/chains.json").isFile) return dir
            dir = dir.parentFile
        }
        error("repository root not found from ${File(".").absolutePath}")
    }

    @Test
    fun registryCopiesMatchCanonicalExport() {
        val root = repoRoot()
        for (name in listOf("chains.json", "tokens.json")) {
            val canonical = File(root, "registry/$name").readBytes()
            val bundled = File(root, "apps/android/app/src/main/assets/registry/$name").readBytes()
            assertArrayEquals("src/main/assets/registry/$name drifted from registry/$name", canonical, bundled)
        }
    }

    @Test
    fun iconCopiesMatchCanonicalWebAssets() {
        val root = repoRoot()
        val chainsDir = File(root, "apps/web/src/assets/chains")
        val tokensDir = File(root, "apps/web/src/assets/tokens")
        assertTrue(chainsDir.isDirectory)
        assertTrue(tokensDir.isDirectory)

        val bundledChains = File(root, "apps/android/app/src/main/assets/icons/chains").listFiles()
            ?.filter { it.extension == "webp" }.orEmpty()
        assertEquals(87, bundledChains.size)
        for (bundled in bundledChains) {
            val canonical = File(chainsDir, bundled.name)
            assertTrue("no canonical source for ${bundled.name}", canonical.isFile)
            assertArrayEquals(
                "icons/chains/${bundled.name} drifted from apps/web/src/assets/chains/${bundled.name}",
                canonical.readBytes(),
                bundled.readBytes()
            )
        }

        val bundledTokens = File(root, "apps/android/app/src/main/assets/icons/tokens").listFiles()
            ?.filter { it.extension == "webp" }.orEmpty()
        assertEquals(8, bundledTokens.size)
        for (bundled in bundledTokens) {
            val canonical = File(tokensDir, bundled.name)
            assertTrue("no canonical source for ${bundled.name}", canonical.isFile)
            assertArrayEquals(
                "icons/tokens/${bundled.name} drifted from apps/web/src/assets/tokens/${bundled.name}",
                canonical.readBytes(),
                bundled.readBytes()
            )
        }
    }

    private fun assertEquals(expected: Int, actual: Int) {
        org.junit.Assert.assertEquals(expected, actual)
    }
}
