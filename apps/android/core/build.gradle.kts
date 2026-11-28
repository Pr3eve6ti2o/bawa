// :core — pure policy/validation plus the Trust Wallet Core binding.
// This is the ONLY module that imports wallet.core.jni types. The
// WalletEngine interface lives here too, so the rest of the app
// compiles and unit-tests against the interface without the native
// artefact; only CoreWalletEngine needs the 4.8.4 AAR.
//
// This tree has NO version catalog: plugin and dependency versions are
// literal here and match the root build.gradle.kts (AGP 8.2.2,
// Kotlin 1.9.22). Do NOT add a catalog or the GitHub Packages maven
// repo (no credentials); the AAR + proto JAR come ONLY from
// core/libs/ via the flatDir repository below (see
// tools/build-core-aar.md). NEVER substitute another Core version
// (e.g. a Maven Central republish at 4.6.0) — the fixture gate pins
// 4.8.4.
//
// flatDir carries no transitive metadata, so the proto JAR's runtime
// dep must be declared explicitly: protobuf-javalite 3.22.3, verified
// first-hand from the 4.8.4 source
// (android/wallet-core-proto/build.gradle: `api
// 'com.google.protobuf:protobuf-javalite:3.22.3'`). The generated proto
// classes are lite-runtime (`--java_out=lite`); protobuf-java (full)
// is the WRONG artefact here.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.bawa.wallet.core"
    compileSdk = 35
    defaultConfig {
        minSdk = 33
        // Consumer ProGuard rules keep the JNI bridge intact.
        consumerProguardFiles("consumer-rules.pro")
    }
    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

// The flatDir repository for the locally built 4.8.4 AAR + proto JAR
// (core/libs/) is declared in settings.gradle.kts: repositoriesMode is
// FAIL_ON_PROJECT_REPOS, so project-level repositories are rejected.

dependencies {
    // Trust Wallet Core 4.8.4, built from source (tools/build-core-aar.md).
    implementation(group = "", name = "wallet-core-4.8.4", version = "", ext = "aar")
    implementation(group = "", name = "wallet-core-proto-4.8.4", version = "", ext = "jar")
    // Lite runtime for the generated proto classes (see header note).
    implementation("com.google.protobuf:protobuf-javalite:3.22.3")
}
