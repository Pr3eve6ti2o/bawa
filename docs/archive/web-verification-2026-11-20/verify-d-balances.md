# Verification Lane D — §6 item 5: read-only mainnet balances + history

- **Lane:** Verification Lane D (read-only verification, no fixes made)
- **Branch:** `panel-rebuild/verify-balances` (new worktree `verify-balances/`, off `panel-rebuild/fix-adapters`)
- **Base commit verified:** `fe6fd76` — `git log --oneline -1` confirmed before starting
- **Date/time:** 2026-11-19 ~22:56–23:00 IST
- **Node:** v22.23.4 via nvm (repo requires >=22 <23; VM default v24.22.2 was NOT used)
- **Sol calls:** 0 — all verification hands-on; no Sol call was needed
- **Scope:** read-only mainnet checks only. Public fixture addresses only. No transfer, send, broadcast, seed, mnemonic or private key involved at any point.

## Method

1. Read all four adapters first-hand: `apps/web/src/wallet/adapters/btc.ts`, `eth.ts`, `trx.ts`, `ton.ts`, plus `types.ts`, `index.ts`, and the balance/history mapping in `apps/web/src/state/wallet-context.tsx`.
2. Exercised the real adapter code (not mocks, not screenshots) through temporary vitest files that called `getBalance` / `getHistory` with live mainnet fetches, then cross-checked each value against a second independent source. Temporary files were run once and DELETED — they are not committed.
3. Forced-failure run: same adapters pointed at an unreachable endpoint (`https://127.0.0.1:9`) to confirm a failed fetch is never rendered as zero.
4. Ran the existing adapter vitest suite.

Live runs (each a single pass per chain; no retries on hard failure — see TON note for the one exception, a transient 429 re-attempted once after a 60 s pause):

| Run | File (temporary, deleted) | Result | Duration |
|---|---|---|---|
| 1 | `verify-d-live.test.ts` (4 chains balance + history + forced failure) | 4 passed, 1 failed — TON history hit TonCenter HTTP 429 (see note) | 5.47 s |
| 2 | `verify-d-live2.test.ts` (BTC exact values + TON history re-attempt after 60 s) | 2 passed | 62.15 s (incl. 60 s sleep) |
| 3 | `verify-d-live3.test.ts` (ETH history count) | 1 passed | <1 s test time |

## Adapters read (code review)

| Chain | Adapter source | Identity check | Balance source | History source |
|---|---|---|---|---|
| BTC | mempool.space | genesis block hash `000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f` | `chain_stats` funded − spent | `/address/{addr}/txs`, limit 25 |
| ETH | publicnode RPC (viem `eth_getBalance`) | RPC must report chain 1 (`eip155:1`) | `client.getBalance` | Blockscout `txlist`, limit 20 |
| TRX | TronGrid | pinned mainnet endpoint returns a well-formed mainnet block | `/v1/accounts/{addr}` (`balance` field; absent = exact 0) | `/v1/accounts/{addr}/transactions`, limit 20, native `TransferContract` only |
| TON | TonCenter JSON-RPC | pinned mainnet host `toncenter.com` (testnet is a different host) | `getAddressBalance` | `getTransactions`, limit 10 |

All four adapters return `AdapterResult`: `{status:'ok', data}` on success, `{status:'error'|'unavailable', reason}` on failure — a failed fetch never produces an `ok` result with value `'0'`. `broadcast()` throws `BROADCAST_DISABLED_MESSAGE` in all four adapters (verified by reading the code).

## Balances — adapter vs second source

All four fixture addresses are exact-zero balances, confirmed as data by two sources each — not failed fetches.

| Chain | Address | Adapter (source) | Adapter value | Second source | Second value | Agree? |
|---|---|---|---|---|---|---|
| BTC | `bc1qpsp72plnsqe6e2dvtsetxtww2cz36ztmfxghpd` | mempool.space | **0 sats** (funded 311775 − spent 311775, tx_count 32) | blockstream.info `/api/address/` | **0 sats** (funded 311775 − spent 311775, tx_count 32) | YES |
| ETH | `0xA3Dcd899C0f3832DFDFed9479a9d828c6A4EB2A7` | publicnode `eth_getBalance` | **0 wei** (`0x0`) | eth.blockscout.com `?module=account&action=balance` | **0 wei** (`"result":"0"`, status `"1"`) | YES |
| TRX | `TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c` | TronGrid `/v1/accounts` | **0 SUN** (no `balance` field) | TronGrid `/wallet/getaccount` (second endpoint — see limitation) | **0 SUN** (no `balance` field; account exists: `create_time` 2021-09-19, `latest_opration_time` 1789514376000) | YES |
| TON | `UQC7gZvGVdCxZhPAazZj43bagBcSYfNvwQZomejemM5wD3zn` | TonCenter `getAddressBalance` | **0 nanoTON** (`"0"`) | tonapi.io `/v2/accounts/` | **0 nanoTON** (`"balance":0`, status `active`, `last_activity` 1701461634) | YES |

## History — through the adapter code

| Chain | Adapter result | Count | Sample entry (real hash / amount / date) | Independent check |
|---|---|---|---|---|
| BTC | `ok` | **25** (limit 25) | `6d2e9737f97b8443d7a54ec49d00f2bc3ac9be715b11727a293e8f04d4135212`, 9180 sats, `out`, 2022-03-16 09:04 UTC, `confirmed` | Hash found in blockstream.info `/txs` page — YES. Also `730eae989d7067d746dc83687005228ec16c496edc3f5c5224946166bbdd77aa`, 10000 sats, `in`, same block time; `0e47c9b7a5aa4ab0e05c7d254323447750bd231260b86b2bcbe878e3a5c32578`, 112145 sats, `out`, 2022-02-16 21:31 UTC |
| ETH | `ok` | **20** (limit 20, full page) | `0x0cf75c8f0889930c87d08b69ba2ce2bc2f497d950f487082c0d741c5d3c83b62`, 0 wei, `in`, 2026-09-27 01:56 UTC, `confirmed`, counterparty `0x371f1aed044d8ee1d96e440f54ff89eaa0dab582` | Blockscout `gettxinfo` for the hash returns status `"1"` — YES. Also `0x5b809e609072bb5f369b59046c3bad5ae6d9075481ed632f1176a3737eb74100`, 0 wei, `in`, 2025-10-21 13:30 UTC, `failed`; `0x8cf824859251429ee5665bf95331e0187cfff9ee998faad2afd87ad66cdf45cf`, 117874853095999 wei, `in`, 2025-10-21 13:29 UTC, `confirmed` |
| TRX | `ok` | **0** (honest empty — see note) | — (no entries) | TronScan API (`apilist.tronscan.org/api/transaction`, no key) lists **45** total txs for this address; the most recent 20 are all contractType 31 (TriggerSmartContract / TRC20) and 2 — zero native `TransferContract` in the adapter's most-recent-20 window. The only 2 native transfers are recency-rank 44/45, from 2021-09-19 (`fe6498ea4c01ac40f83e397b2bb07cef1e020199f4b2cde521a56cc9dbb0dd18`, `5ed50f9fdfb080051abfc511ed2237a0f6e755d1550e6ea4ac0cf2aaf0a16a1a`) — outside the window. Empty is the correct answer for this query. |
| TON | `ok` (on re-attempt; first attempt `error` HTTP 429 — see note) | **2** | `088cbcac96e2b64f8d90dca1d80235d3e8eab32d249bea774a4b1c96c6b46177`, 985488590 nanoTON (~0.985 TON), `out`, 2023-12-01 20:13 UTC, `confirmed`, counterparty `EQAIo4ZwEDChCuIk5JBmamuArQqXEvTXiYBl52CuBQOtTpTB` | tonapi.io `/v2/accounts/{addr}/events` returns 2 events; first `event_id` is exactly `088cbcac96e2b64f8d90dca1d80235d3e8eab32d249bea774a4b1c96c6b46177` — YES. Also `1f985ec96d142188357ddf3264012d22d821cc403fd5016b5dce31e194f2245d`, 1000000000 nanoTON (1 TON), `in`, 2023-11-21 06:20 UTC, `confirmed` |

## Zero vs unavailable/error

**Code:** `apps/web/src/state/wallet-context.tsx` `refreshBalances` maps `ok` + `valueBaseUnits === '0'` → `{status:'zero'}`, `ok` + non-zero → `{status:'available'}`, `unavailable` → `{status:'unavailable', reason}`, `error` → `{status:'error', reason}` — with the comment "A failed fetch is reported as unavailable/error, never as zero." `refreshHistory` maps `ok` + empty → `{status:'empty'}`, failures → `unavailable`/`error` with empty `txs`. No path renders a failed fetch as a zero balance.

**Forced-failure run** (adapters pointed at unreachable `https://127.0.0.1:9`):

| Chain | Forced-failure balance result | Rendered as zero? |
|---|---|---|
| BTC | `{status:'error', reason:'Network error: fetch failed'}` (balance + history) | No |
| ETH | `{status:'error', reason:'HTTP request failed… eth_chainId… fetch failed (viem@2.58.0)'}` | No |
| TRX | `{status:'error', reason:'Network error: fetch failed'}` | No |
| TON | `{status:'error', reason:'Network error: fetch failed'}` | No |

## Vitest — existing adapter tests

Command (in `apps/web`, Node v22.23.4): `npx vitest run src/wallet/adapters/`

- **49/49 passed, 5 files, 0 failed** (553 ms): `btc.test.ts` 9, `eth.test.ts` 10, `ton.test.ts` 10, `trx.test.ts` 9, `types.test.ts` 11.

## Verdicts

| Chain | Balance | History |
|---|---|---|
| BTC | **PASS** — 0 sats, both sources agree exactly (funded = spent = 311775) | **PASS** — 25 real txs, sample hash verified on blockstream.info |
| ETH | **PASS** — 0 wei, publicnode and Blockscout agree | **PASS** — 20 real txs, sample hash verified on Blockscout |
| TRX | **PASS** — 0 SUN, both TronGrid endpoints agree (weaker independence — see limitation) | **PASS** — empty native-transfer history is correct for the most-recent-20 window (see note); no fake entries |
| TON | **PASS** — 0 nanoTON, TonCenter and tonapi.io agree | **PASS** — 2 real txs, first hash matches tonapi.io event exactly (after one 429 re-attempt — see note) |

## Limitations and observations (recorded honestly, not failures)

1. **TRX second source is weaker:** the independent TronScan API (`apilist.tronscanapi.com/api/accountv2`) now returns **HTTP 401** (Fix Lane 2 hit a rate-limit suspension instead) — it appears to require an API key now. The cross-check fell back to TronGrid's second endpoint (`/wallet/getaccount`), same provider as the adapter. Independence is weaker, as in Lane 2. The account demonstrably exists (created 2021-09-19, recent operation time, TRC20 holdings), so "no balance field → 0 TRX" is the provider's answer, not a missing account.
2. **TON history first attempt 429:** the first pass's `getHistory` returned `{status:'error', reason:'HTTP 429'}` from TonCenter (free-tier throttle on burst calls). The adapter behaved correctly — it reported an error, never fake or empty data. One re-attempt after a 60 s pause succeeded with 2 real txs matching tonapi.io. This is a transient provider throttle, not an adapter defect, but it shows TON history can surface as "error" under burst load.
3. **TRX history is native-only by design:** the adapter skips TRC20/contract calls (`trx.ts`: "History covers native TRX transfers only… skipped, not fabricated"). This address has 45 txs but only 2 native ones (both Sep 2021), so a user with only TRC20 activity sees an empty history. Accurate within its stated scope; the scope gap is a product note, not a verification failure.
4. **No live non-zero balance was checked** (same limitation as Lane 2): all four fixture addresses are exact-zero. Non-zero rendering is covered by unit tests with stubbed adapters (e.g. 1.5 ETH renders "1.5 ETH"). A funded public address would be needed to close this; none was used.
5. **Observation (not in §6 scope):** `toBalanceProvider` in `adapters/types.ts` maps a non-`ok` history result to `[]`, swallowing the error for the legacy `BalanceProvider` path. The live UI path (`wallet-context.tsx` `refreshHistory` via `getAdapter`) does NOT use that wrapper and preserves `unavailable`/`error`, so this does not affect what the user sees — but the legacy wrapper hides history failures.
6. **BTC precision note (recorded in code):** balances use JSON numbers (`funded_txo_sum`/`spent_txo_sum`) via `BigInt(Math.trunc(...))`; precision above `Number.MAX_SAFE_INTEGER` is a documented limitation. The fixture values (311775) are far below it.

## Commands run

```text
# Worktree + base check (muse-vm, via boxd)
git worktree add /home/boxd/workspace/bawa-panel-rebuild/verify-balances -b panel-rebuild/verify-balances panel-rebuild/fix-adapters
git log --oneline -1   # fe6fd76 Fix Lane 2: Phase 2+3 evidence + 500s prompt re-split (final)

# Deps (no install; node_modules copied from the sibling fix-adapters worktree, same tree)
cp -a /home/boxd/workspace/bawa-panel-rebuild/fix-adapters/apps/web/node_modules \
      /home/boxd/workspace/bawa-panel-rebuild/verify-balances/apps/web/node_modules

# Live checks (Node v22.23.4 via nvm; temp files run once, then deleted)
npx vitest run src/wallet/adapters/verify-d-live.test.ts --reporter=verbose   # 4 passed, 1 failed (TON 429)
npx vitest run src/wallet/adapters/verify-d-live2.test.ts --reporter=verbose  # 2 passed (incl. 60 s sleep)
npx vitest run src/wallet/adapters/verify-d-live3.test.ts --reporter=verbose  # 1 passed
rm src/wallet/adapters/verify-d-live.test.ts src/wallet/adapters/verify-d-live2.test.ts src/wallet/adapters/verify-d-live3.test.ts

# Independent TRX cross-checks (read-only curl)
curl "https://apilist.tronscan.org/api/transaction?sort=-timestamp&count=true&limit=50&address=TJ9VWHMsmZLeA5Xp6WmDLiN4as1eySgB9c"

# Existing adapter tests
npx vitest run src/wallet/adapters/   # 49/49 passed, 5 files
```

## Sol calls

None. 0 made, 0 landed. Hands-on verification only.
