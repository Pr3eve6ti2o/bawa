# ai/request-routing.md

Read `AGENTS.md` and `WALLET_BUILDER.md`. Governing policy, layer rules and engine detail remain there and in `docs/AI-WALLET-BUILDER-IMPLEMENTATION-PLAN.md`.
The seven profiles are validated in `registry/profiles.json`; one profile file exists per profile in `ai/profiles/<id>.md`; the mapped prompt per profile is `ai/prompts/create-<id>.md`. A routing match is not proof of availability or verification.
Follow the entry-point workflow: parse → plan → profile → engine → chains → template → inspect → scaffold → implement → verify → audit claims → report.

## Classify the request

1. Parse the requested interface, operations, chains and deliverable. Screen unsupported intent against the refusal list below.
2. Match the intended build contract, not an isolated keyword, to the table.
3. Use the mapped prompt and `ai/profiles/<id>.md`, substituting the listed profile ID. Do not invent a generic profile file.
4. If the intended profile is ambiguous, do not guess. The CLI (`scripts/build-wallet.mjs`) never waits for an answer: it writes an AMBIGUOUS report (profile null, exit 2). If multiple profiles are explicitly requested, split the builds into one invocation per profile (the CLI reports AMBIGUOUS with `ambiguous: 'split'`, exit 2 — it does not execute two builds). An interactive agent may instead ask one clarifying question and wait, but must not present the CLI as waiting.

| Intent / keywords | Example request | Profile ID | Prompt |
| --- | --- | --- | --- |
| CLI, command-line HD generation/derivation/recovery; BTC/ETH/TRX watch-only | “Build a CLI HD wallet with recovery and BTC/ETH/TRX watch-only.” | `hd-wallet-cli` | `ai/prompts/create-hd-wallet.md` |
| Bitcoin, BTC derivation, 6-confirmation contract, Bitcoin watch-only | “Build a Bitcoin derivation and watch-only wallet with a 6-confirmation policy.” | `bitcoin-wallet` | `ai/prompts/create-bitcoin-wallet.md` |
| ETH/EVM language with explicit ETH derivation and finalized-policy intent | “Build an ETH derivation wallet using the finalized policy.” | `evm-wallet` | `ai/prompts/create-evm-wallet.md` |
| BTC/ETH/TRX/TON multichain; TON generation-only | “Build a BTC/ETH/TRX/TON wallet, with TON generation only.” | `multichain-wallet` | `ai/prompts/create-multichain-wallet.md` |
| Browser, web wallet UI, 14 screens, token-ui | “Build a 14-screen web wallet using token-ui.” | `web-wallet` | `ai/prompts/create-web-wallet.md` |
| Android, Kotlin wallet UI, 14 screens | “Build a 14-screen Android wallet UI.” | `android-wallet` | `ai/prompts/create-android-wallet.md` |
| Watch-only, extended public keys, xpub input, no secrets/signing | “Derive addresses only from extended public keys, without secrets or signing.” | `watch-only-wallet` | `ai/prompts/create-watch-only-wallet.md` |

## Generate the project

The one-prompt workflow is `scripts/build-wallet.mjs "<request>"`. It classifies, generates the profile's project with `scripts/generate-project.mjs` into `generated/<profile-id>`, verifies that generated project, and writes a JSON report. Its classification order is: both web+android words → split-required (AMBIGUOUS) report, exit 2 — the caller runs one build per profile; the CLI does not execute two builds; android → android-wallet; web/website/browser → web-wallet; multi-chain/multichain → multichain-wallet; hd/hierarchical deterministic/cli/command-line → hd-wallet-cli; bitcoin/btc → bitcoin-wallet (bitcoin + watch-only without generation language selects watch-only-wallet); evm/ethereum/eth → evm-wallet (ETH derivation only); watch-only/watch only/xpub/extended public key → watch-only-wallet; otherwise unclassifiable. It does not require the word "wallet". The CLI never waits for input: an unclassifiable request writes a classification-failure report (profile null, exit 2); a refused request writes a refusal report (profile null, `refusal` carrying the exact sentence below, exit 2); an ambiguous request writes an AMBIGUOUS report (profile null, exit 2).

## Scope boundaries affecting routing

- Testnet is the default throughout. Mainnet without separate approval must be refused. Unspecified testnet path/network details are OPEN; supplied derivation references do not authorize mainnet use.
- No signing or broadcast code exists in this repo. A wallet name, UI screen or foundation choice does not establish those capabilities.
- ETH derivation does not establish generic EVM operation. Unspecified EVM capabilities are OPEN, not supported claims.
- TON is generation-only in the proposed multichain profile: no send and no xpub. TRX derivation is `m/44'/195'/0'/0/i`; TON derivation is `m/44'/607'/0'`, generation-only.
- Web uses owner-approved `token-ui` (vendored in `apps/web/src/ui/`); Android uses owner-approved Tether WDK Starter Kotlin UI layer only. Phase 5 inspected these foundations; the web starter exists in `apps/web` (25 tests, build + preview verified); no live browser run has been performed.
- An Android debug APK is produced by `./gradlew assembleDebug` (52,456,212 bytes, verified); no AAR exists for any version, and on-device derivation is not implemented.
- Web, Android and watch-only chain/path coverage not supplied here is OPEN; do not borrow another profile's capabilities.

## Ambiguous requests: ask one question

In an interactive session, leave profile selection OPEN until the answer resolves the ambiguity. The questions below are alternatives, not a questionnaire. The CLI does not ask or wait: it writes an AMBIGUOUS report (profile null, exit 2) — see "Generate the project".

- “Build a wallet”: ask, “Which build do you want: CLI HD, Bitcoin, ETH-focused EVM, BTC/ETH/TRX/TON multichain, web UI, Android UI, or extended-public-key-only watch-only?”
- “Bitcoin watch-only wallet”: in an interactive session, ask, “Do you want the Bitcoin profile's 6-confirmation contract or the extended-public-key-only watch-only profile?” The CLI does not ask: bitcoin + watch-only without generation language selects `watch-only-wallet`.
- “EVM wallet” without a clear operation: the default is ETH derivation (`evm-wallet`); ask a clarifying question only when a non-ETH chain or a non-derivation operation is named.
- “Mobile wallet” without a platform: ask, “Do you mean the listed Android UI profile?”

Ask only one applicable clarifying question and wait; do not guess or silently expand scope.

## Multi-profile requests

- Split explicitly requested profiles into separate builds, with one profile and its mapped prompt per build. Keep scope, verification and claims separate. The CLI does not execute two builds: a request naming web + Android produces a split-required (AMBIGUOUS) report (profile null, exit 2), and the caller must run one invocation per profile. Other multi-profile combinations follow the classification order's first-match precedence (the first matching profile wins; the rest are not built).
- Example: “Build web and Android wallets” becomes one `web-wallet` build and one `android-wallet` build, not a merged profile — the caller runs each separately, because the CLI reports AMBIGUOUS for the combined request.
- The listed `multichain-wallet` is one proposed profile; it is not permission to merge the Bitcoin and EVM profiles.
- A UI request mentioning BTC does not authorize merging UI and Bitcoin profiles. Check the UI profile's chain scope; if the intended build boundary is ambiguous, ask one question.
- If the request insists on an unlisted combined profile, use the unlisted-profile refusal below.

## Unsupported requests: exact sentences to report

Report the matching sentence verbatim for each unsupported part. Do not improvise an implementation or silently substitute another feature or network. Route any remaining explicitly requested, routable parts separately.

| Unsupported intent | Exact sentence |
| --- | --- |
| Mainnet use without separate approval | “I cannot support mainnet use without separate approval; the default scope is testnet.” |
| Swaps, staking or bridges | “I cannot provide swaps, staking or bridges; they are out of scope for this programme.” |
| Signing or broadcast claims without an engine that implements them | “I cannot claim signing or broadcast support without an engine that implements them; no signing or broadcast code exists in this repository.” |
| TON send | “I cannot provide TON send; TON is generation-only in the proposed multichain profile.” |
| Any profile not among the seven listed here | “I cannot route this request to an unlisted profile; only the seven profiles listed here are eligible for routing.” |
| TON xpub | “I cannot provide TON xpub support; the proposed TON scope has no xpub support.” |

Separate mainnet approval does not itself establish implementation or verification.

## Pending validation and reporting

- Route a matching request and report its registry status (`DOCUMENTED_NOT_TESTED` or `STARTER_IMPLEMENTED_AND_VERIFIED`) with the implemented/missing lists. Record the profile ID and prompt.
- If an entry-point or planned profile file, verification procedure or result is unavailable, record OPEN. Do not invent missing file contents, tests or evidence.
- Require the profile's recorded evidence before promising it or claiming it is verified. Existing engine evidence or owner approval of a foundation is not a substitute.
- Carry the selected profile's verification requirements into the plan and report. For web/Android, retain the 14-screen contract requirement and the recorded Phase 5 foundation inspection.
- Use evidence labels only as justified: IMPLEMENTED_AND_VERIFIED / STARTER_IMPLEMENTED_AND_VERIFIED / DOCUMENTED_NOT_TESTED / PROPOSED / OPEN / EXTERNALLY_DEPENDENT / UNVERIFIED. STARTER_IMPLEMENTED_AND_VERIFIED means the starter for the profile is implemented and verified within its documented scope; it is not a complete wallet.
- Report the selected route or split routes, testnet scope, refused parts, validation and inspection gaps, OPEN facts, evidence labels and next required verification. Do not claim capabilities beyond the evidence.
