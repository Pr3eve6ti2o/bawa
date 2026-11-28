# Bawa Android — Steps 5 + 6 record

Step 5 (network stack) + Step 6 (UI wiring to live data). Hands-on,
0 Sol calls, on loud-stone. Base: `panel-rebuild/token-gaps` at
`dc97f6b` (all three Step 5 lanes merged, 126 unit tests green).
Step 6 branch: `android-step6-ui` (local commits only, never pushed).

## Step 5 — what was built

### Lane A — live token prices (commit `5934887`)

- `data/network/PriceRepository.kt` (381 lines) — prices for the 21
  curated tokens from five keyless sources in the web's fallback
  order: CoinGecko `/simple/price` (batched, fresh quotes only, 10
  min max age, 24 h change where provided), DexScreener
  `/tokens/v1/{chain}/{addresses}` (base-side pairs win; quote-side
  pairs price ONLY by the implied price `priceUsd / priceNative` —
  the TRON USDT trap), TonAPI `/v2/rates` (TON Jettons), CoinLore
  `/api/ticker` and Coinbase Exchange tickers (native assets only).
  A token no source prices is `Unavailable`, never 0; a 24 h change
  is reported only where the source provides it, never a fabricated
  0. Every result names the provider that actually answered.
- `data/network/HttpTransport.kt` — `HttpTransport` (GET returning
  a `HttpResult` sealed type: `Response(status, body)` /
  `Failure(message)`) + `OkHttpHttpTransport` (10 s timeouts).
- Tests: `data/network/PriceRepositoryTest.kt` (351 lines, fake
  transport, no network).

### Lane B — live balances + live history (commit `66f1708`)

- `data/LiveBalanceRepository.kt` (498 lines) — native + curated
  token balances: EVM `eth_getBalance` / ERC-20 `balanceOf` over the
  registry RPCs in order (first 200 wins), Solana `getBalance`,
  TRON Trongrid -> PublicNode, TON TonCenter -> TonAPI, BTC/LTC
  Esplora, DOGE SoChain -> BlockCypher. Keyless sources only; a
  chain with no keyless source answers `Unavailable` with the
  reason, never $0.00. SPL (Solana) and Jetton (TON) token balances
  answer `Unavailable` — not implemented, said so honestly.
- `data/LiveHistoryRepository.kt` (808 lines) — history + hash
  lookup: EVM Blockscout txlist (8 chains), Etherscan V2 keyless
  (Linea, 1 request / 5 s, one retry), gnosisscan.io (Gnosis),
  Routescan (avax, mantle); SOL `getSignaturesForAddress`, TRX
  Trongrid (+ TronScan fallback), TON TonCenter, BTC/LTC Esplora,
  DOGE SoChain (+ BlockCypher). The five statuses — Pending,
  Included, Confirmed, Failed, Replaced — stay distinct, nothing
  merged, nothing invented.
- `data/HttpTransport.kt` — Lane B's own throwing transport
  (GET + POST-JSON returning `String`).
- `data/LiveDataHelpers.kt` (138 lines) — shared defensive JSON
  parsing (base58/hex/base64, decimal-to-base-units).
- Tests: `LiveBalanceRepositoryTest.kt` (444 lines) +
  `LiveHistoryRepositoryTest.kt` (348 lines), fake transports.

### Lane C — QR scanner (commit `78d5475`)

- `ui/scanner/QrCodeScanner.kt` (344 lines) — standalone CameraX
  QR/barcode scanner: `onScanned` fires exactly once with the
  decoded text; `onError` fires with a human-readable reason when
  the camera cannot be used; runtime CAMERA permission with an
  honest denied state (settings button + ask-again); torch toggle
  only when the camera reports a flash unit. It only reads the code
  and returns the text; it never sends anything anywhere.
- `ui/scanner/QrCodeCodec.kt` (110 lines) — ZXing encode/decode;
  `QrCodeImage` now encodes at error-correction level M.
- `AndroidManifest.xml` — CAMERA permission declared.
- Deps (commit `44c9623`): OkHttp 4.12.0 + CameraX 1.3.4.
- Tests: `QrCodeCodecTest.kt` (109 lines, JVM decode tests).

## Step 6 — what was built

Step 6 wires the UI shell to the Step 5 data layer. No feature is
shown as functional unless it works; no value is ever invented.

### The address gap (the crux)

The ViewModel held xpubs; the live repositories need addresses.
Step 6 closes that gap with on-device derivation through the
Trust Wallet Core 4.8.4 engine (Step 4 AAR in `core/libs/`):

- `data/AddressDeriver.kt` (new) — `AddressDeriver` interface
  (`deriveAddress(chain, xpub, index)` -> `DerivedAddressResult`:
  `Available(address, path)` / `Unavailable(reason)`) plus
  `CoreAddressDeriver(engine: WalletEngine)`. The engine's fixture
  gate runs lazily once, on the first derivation, on the caller's
  background thread — never at app startup, never on the UI thread.
  A failed gate, or an engine that cannot initialise, makes every
  derivation `Unavailable` with the reason. TON has no xpub, so the
  engine refuses it and the answer is `Unavailable`, never an
  invented address. Derivation is index 0 only (first receiving
  address of the imported account).
- `MainActivity.kt` (factory only) — constructs the live
  repositories on one shared `OkHttpHttpTransport` plus the
  `CoreAddressDeriver(CoreWalletEngine())`. Each construction is
  guarded on its own: a failure falls back to `null` for that piece
  only, never a crash. `CoreWalletEngine()` loads the native library
  and throws when it cannot — that is a null deriver, never a crash.

### Transport unification (done, tests green)

The two `HttpTransport` interfaces are unified into one —
`data.network.HttpTransport` — as the task ordered, and all tests
stayed green, so no duplication remains:

- `data/network/HttpTransport.kt` gained `postJson(url, body):
  HttpResult`, implemented in `OkHttpHttpTransport`, plus the
  throwing adapters `getText` / `postJsonText` (200 -> body, other
  status -> `HttpStatusException`, no response -> `IOException`)
  that let the balance/history repositories keep their try/catch
  shape. `HttpStatusException` moved here from the deleted file.
- `data/HttpTransport.kt` (Lane B duplicate) deleted.
- `LiveBalanceRepository` / `LiveHistoryRepository`: constructor
  default `OkHttpTransport()` -> `OkHttpHttpTransport()`, call
  sites `transport.get(` -> `transport.getText(`,
  `transport.postJson(` -> `transport.postJsonText(`. No behaviour
  change: same timeouts (10 s), same failure mapping.
- Test fakes updated to the unified interface
  (`LiveBalanceRepositoryTest`, `LiveHistoryRepositoryTest` — their
  `dispatch` now wraps into `HttpResult.Response(200, …)` /
  `HttpResult.Failure(…)`; `PriceRepositoryTest` fake gained a
  `postJson` returning `Failure`).

### Native-asset prices (additive Step 6 method)

The curated token export lists contract tokens only — there is no
token record for a chain's native asset, so `prices()` could not
price BTC/ETH/TRX and the portfolio total could never be computed.
`PriceRepository` gained `nativePrices(chainIds)` (keyed by chain
id), resolving the native from the chain registry (CoinGecko id +
fallback ids) and running the same A/B/C legs over a synthetic
record via a shared private `priceResolved()` — `prices()` is
refactored onto it with no behaviour change. The synthetic record
has no contract, so the DexScreener and TonAPI legs skip it (both
need a contract address); CoinGecko, CoinLore and Coinbase price it
from the chain's ids. Unknown chains are `Unavailable`.

### ViewModel (`ui/WalletViewModel.kt`)

Optional constructor params in the existing pattern (no-arg
construction keeps working): `balanceRepository`,
`historyRepository`, `priceRepository`, `addressDeriver`.
`liveAvailable` is true when any of them is present.

- `refreshLiveData(chains?)` (suspend, Dispatchers.IO) — derives
  the index-0 address, then fetches the native balance, curated
  token balances (`LiveBalanceRepository.tokenBalances`), history
  and prices (native + tokens) in parallel per chain. Chains
  already refreshing are skipped. A repository call that throws
  anyway becomes `Unavailable`, never a crash (cancellation still
  propagates). `requestRefresh()` is the UI's entry point
  (viewModelScope). The ViewModel never fetches on its own — screens
  trigger a refresh when they appear (`LaunchedEffect`) and the
  Refresh button re-runs it — so `addWallet` stays synchronous and
  the existing tests keep passing in plain JUnit (no Main
  dispatcher is touched except by `requestRefresh` / `requestLookup`).
- StateFlows: `addresses`, `balances`, `tokenBalances` (keyed by
  token key), `prices` (keyed by chain id for natives, token key
  for tokens), `history`, `refreshing` (the Loading state),
  `lastRefreshMs`, `totalWorthUsd` (null when nothing is priced —
  the UI shows "Unavailable", never $0.00), `unpricedHoldings`
  (holdings with a real balance but no price — listed without a
  value), `lookupResult` / `lookupHash`, `scanTarget`,
  `scannedAddress` (stored verbatim — no URI parsing),
  `scanError`, `sendRecipient`, `detailTxChain`.
- `lookupTransaction(chain, txHash)` (suspend) + `requestLookup()`
  — clears the previous answer first, so a slow lookup never shows
  a stale result for a different hash.
- `openTransactionDetail(txId, chain)` now takes the chain (no
  other callers existed).
- `removeWallet` clears that chain's live entries and recomputes
  the total.
- Scanner state: `openScanner(target)` / `closeScanner()` /
  `onScanned(text)` (a Send scan also fills the recipient) /
  `onScanError(reason)` / `setSendRecipient` /
  `clearScannedAddress`.

### Formatting (`ui/LiveDataFormatting.kt`, new, pure Kotlin)

`formatCryptoAmount` (base units -> human amount, null on bad
input), `displayAmount`, `usdValue` (balance x price, null unless
both sides are available), `formatUsd` (grouped, two decimals; a
real total under one cent shows "< $0.01", never "$0.00"),
`formatChange24h` ("+2.34%", null when the source did not provide
one), `totalWorthUsd` (null when nothing is priced).

### Screens

- **Portfolio** — real balances + live prices + total worth (sum
  of priced holdings only; unpriced counted in the note). Asset
  rows show the balance, the holding value, or the unit price
  ("1 ETH = $2,000.00") when there is no balance to value. Hero
  has a Refresh button and a last-refresh note. The stale "no
  provider" card now shows only when no live repository is
  configured; otherwise a short read-only note.
- **AssetList** — same live rows as the Portfolio list.
- **AssetDetail** — derived deposit address (+ path), live balance
  + USD value, live price + 24 h change + source, curated tokens
  on the chain with live balances and prices, recent transactions
  (five statuses distinct, tap for detail). The stale "addresses
  are not derived on-device" card is replaced by the on-device
  derivation note when derivation worked; the repo-tools fallback
  text stays for when it did not.
- **Receive** — derived address + QR code (`QrCodeImage`) for the
  selected chain, Scan button opening `QrCodeScanner` as a
  full-screen overlay (Close exits without scanning). The scanned
  text is shown verbatim in a card with a verify-before-use note
  and a Clear button; scanner errors are shown.
- **Send** — recipient field is now editable with a Scan button
  that fills it from the scanner overlay; the review rows show the
  entered recipient in full. Amount stays disabled and Review stays
  disabled: sending is not implemented (no signing, no broadcast).
  The fee line now says fee estimation is not implemented (the old
  "no provider is selected" is no longer true).
- **TransactionHistory** — real history for the selected chain
  (tap a row for detail) plus the Track lookup wired to
  `lookupTransaction`: found records with distinct statuses, an
  honest not-found, or the provider's reason.
- **TransactionDetail** — looks the hash up on its chain and shows
  the record (hash, distinct status, explorer URL), not-found, or
  the reason.
- TON stays "not supported" for import (no xpub exists for it);
  the watch-only set is BTC/ETH/TRX.

### `app/build.gradle.kts` (header comment only)

Corrected the stale comment: the Trust Wallet Core 4.8.4 AAR **is**
in `core/libs/` (Step 4) and Step 6 wires the engine for watch-only
derivation; no signing/broadcast call sites exist.

### Tests (new files, plus the unification fake updates above)

- `ui/WalletViewModelLiveDataTest.kt` (new, 9 tests) — real
  `LiveBalanceRepository` / `LiveHistoryRepository` /
  `PriceRepository` against a fake transport (no network): balance
  + price + history + total flow into state; `Unavailable` shows
  its reason and the total stays null; an unpriced holding is
  excluded from the total and counted; derivation-unavailable
  skips balances/history but not prices; lookup finds a Confirmed
  transaction and a blank hash clears; scan fills the Send
  recipient; `removeWallet` clears live entries; refresh with no
  wallet is a no-op; no-arg construction still works.
- `ui/LiveDataFormattingTest.kt` (new, 8 tests) — amount/price/
  change/total formatting incl. the "< $0.01" rule.
- `data/network/NativePricesTest.kt` (new, 5 tests) — CoinGecko
  natives with change, unknown chain, empty input, DexScreener +
  TonAPI skipped for natives, stale CoinGecko falling through to
  Coinbase.

## Gates (loud-stone, ANDROID_HOME=/home/boxd/Android/Sdk, JDK 17)

- Baseline at `dc97f6b` (before Step 6): `./gradlew
  testDebugUnitTest` BUILD SUCCESSFUL — 126 tests, 0 failures.
- Step 6: `./gradlew assembleDebug` BUILD SUCCESSFUL
  (`app-debug.apk` built); `./gradlew testDebugUnitTest` BUILD
  SUCCESSFUL — **148 tests, 0 failures, 0 errors** (126 pre-existing
  + 22 new: 9 `WalletViewModelLiveDataTest`, 8
  `LiveDataFormattingTest`, 5 `NativePricesTest`). One compile fix
  during the run: smart-cast on delegated properties in
  `TransactionDetailScreen` (local vals instead).
- Step 6 commit: local on `android-step6-ui`, never pushed (see
  `git log` for the hash).

## Honest gaps (still open)

- **On-device fixture gate + on-device camera check** — still need
  a device or emulator; none was available. The gate is wired to
  run lazily on first derivation (`CoreAddressDeriver`) and the
  camera path is covered by JVM decode tests + a successful build,
  but neither has run on hardware. Do NOT claim them.
- **TON watch-only import** — no xpub exists for TON and the
  engine refuses it; TON stays import-unsupported.
- **Fee estimation** — not implemented; Send shows that honestly.
- **Sending** — not implemented (no signing, no broadcast, no
  transaction construction anywhere).
- **Scanned text is stored verbatim** — no EIP-681 / BIP-21 URI
  parsing; a scanned payment URI fills the recipient as-is.
- **SPL / Jetton token balances** — `Unavailable` by design (Step
  5, Lane B); the UI shows the reason.
- **History coverage** — only the chains with a keyless indexer
  (Step 5, Lane B); every other chain answers `Unavailable` with
  the reason, and the UI shows it.
- **Lookup staleness** — none: `lookupTransaction` clears the
  previous answer before fetching.
- **Refresh is screen-driven** — `addWallet` does not auto-fetch;
  Portfolio / AssetList / AssetDetail / Receive / History refresh
  on appearance, plus the manual Refresh button.
