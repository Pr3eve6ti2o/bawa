// Bawa Android wallet — Gradle settings.
// UI-only adoption of the Tether WDK Starter (Apache-2.0, pin a4fa2172).
// The starter's :wdk-core-kotlin module is NOT included: it lives
// outside the WDK starter repo and the starter does not build with it.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Locally built Trust Wallet Core 4.8.4 AAR + proto JAR live in
        // core/libs/ (Step 4). flatDir is declared here (not in the
        // :core build file) because repositoriesMode is FAIL_ON_PROJECT_REPOS.
        flatDir {
            dirs("core/libs")
        }
    }
}
rootProject.name = "bawa-android"
include(":app")
include(":core")
