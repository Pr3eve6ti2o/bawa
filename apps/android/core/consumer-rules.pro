# :core consumer ProGuard rules — keep the Trust Wallet Core JNI bridge intact.
# No consumer-rules.pro existed in the reference module; these rules are
# written for this tree (Step 4, Lane B). They only matter if a consumer
# enables minification; both :core and :app ship with minifyEnabled=false.
# The JNI entry points are reached from native code by name, so they must
# never be renamed or stripped.

# Generated JNI bindings (wallet.core.jni) and the hand-written AnySigner
# helper (wallet.core.java), plus the generated proto classes.
-keep class wallet.core.jni.** { *; }
-keep class wallet.core.java.** { *; }
-keep class wallet.core.jni.proto.** { *; }

# Native methods are resolved by name at runtime; keep them all.
-keepclasseswithmembernames class * {
    native <methods>;
}

# The TrustWalletCore native library is loaded by name in CoreWalletEngine.
-keep class com.bawa.wallet.core.CoreWalletEngine { *; }
