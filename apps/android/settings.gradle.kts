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
    }
}
rootProject.name = "bawa-android"
include(":app")
