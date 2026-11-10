# Sample requests

Run these commands from the repository root. The workflow selects existing
watch-only starters and writes their setup, build and test results to a JSON
report. `VERIFIED` describes a successful step, not a fully featured wallet.

Web uses npm. Android uses the Gradle wrapper, with `JAVA_HOME` pointing to
JDK 17 and `ANDROID_HOME` pointing to an Android SDK with platform 35 installed.
Successful outcomes assume the required toolchains and dependencies are available.

## 1. Create a Web wallet

~~~sh
node scripts/build-wallet.mjs "Create a Web wallet" --out reports/web-report.json
~~~

- Expected profile: `web-wallet`.
- Expected platforms: `[web]`.
- Expected outcome: Web setup, build and test are each `VERIFIED`.
- Capability boundary: Web derives in-browser via wallet-core WASM, as
  documented. Balances are not implemented (no provider), and send is not
  implemented. Verification does not remove these limitations.

## 2. Create an Android wallet

~~~sh
node scripts/build-wallet.mjs "Create an Android wallet" --out reports/android-report.json
~~~

- Expected profile: `android-wallet`.
- Expected platforms: `[android]`.
- Expected outcome: Android setup, build and test are each `VERIFIED` when
  the required toolchain is present. If either `JAVA_HOME` or `ANDROID_HOME`
  is missing, Android setup is `SKIPPED`, not `FAILED` or `VERIFIED`; this
  must not be presented as a verified Android build or test.
- Capability boundary: on-device derivation is not implemented (no AAR).
  Balances (no provider) and send are not implemented.

## 3. Create a multi-chain wallet

~~~sh
node scripts/build-wallet.mjs "Create a multi-chain wallet" --out reports/multichain-report.json
~~~

- Expected profile: `multichain-wallet`.
- Expected platforms: `[web, android]`.
- Expected outcome: with both toolchains available, setup, build and test
  are each `VERIFIED` independently for Web and Android. Success on one
  platform does not imply success on the other; inspect both sets of results.
  Missing Android toolchain variables produce the Android setup `SKIPPED`
  outcome described above, not an Android pass.
- Shared policy, not shared code: the two starters share the derivation
  policy and confirmation policy, but not code.
- Capability boundary: Web derives in-browser via wallet-core WASM;
  Android on-device derivation remains unimplemented (no AAR). Neither
  starter implements balances (no provider) or send.

## What the workflow does not do

- It does not generate new wallet code; it selects and verifies existing starters.
- It does not sign or broadcast transactions.
- It does not invent capabilities or treat mock/unresolved features as implemented.
- A `FAILED` step stops later steps for that platform. Those later steps are
  `NOT-RUN`, never a pass. `SKIPPED` is not a pass either.
