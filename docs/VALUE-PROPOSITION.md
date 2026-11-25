# Bawa — value proposition

**Version:** v1 — 2026-11-23 (marketing-fix Lane 3); chain count updated 2026-11-26 (guide-update pass): 22 → 87 chains, 22 enabled by default — see the dated note at the end.
**Status:** wording for Lane 4 to take into the root README rewrite. Every
claim below was checked against the build on branch `panel-rebuild/marketing-fix`
at `4c4cad9` before it was written; the evidence pointer after each claim is
where to re-check it. Nothing here is invented, and nothing here claims a
feature that is still "coming soon".

## The one line

> **Your keys, your coins — on 87 chains, in your browser.**

Subline, for the README and the welcome screen:

> Bawa is a self-custodial wallet that runs in your browser. One recovery
> phrase covers 87 chains, 22 enabled by default. Your keys are made on this device, encrypted
> with your vault password, and never leave it. Sending stays switched off
> until it is separately approved — so nothing here can move your funds.

## Why anyone would choose this wallet

Most wallets ask for trust first and explain later. Bawa is built the other
way round: the things a choosing user has to take on trust are the things
this wallet does not ask for.

1. **You hold the keys — really.** Your 24-word recovery phrase is made in
   this browser from 256 bits of secure entropy and encrypted with your
   vault password. Your private keys stay in memory on this device while
   the wallet is open; they are never saved unencrypted, written to logs
   or sent online. There is no account holding your funds and nobody to
   freeze them. (Evidence: `apps/web/src/wallet/core.ts` — "Generate a
   24-word mnemonic from 256 bits of secure entropy"; Security screen
   copy in `apps/web/src/screens/security-settings.tsx`.)
2. **One phrase, 87 chains.** Bitcoin, Ethereum, Solana, TRON, TON, BNB
   Smart Chain, Polygon, Arbitrum, Optimism, Base, Avalanche, Litecoin,
   Dogecoin, Gnosis, Celo, Linea, Mantle, Scroll, opBNB, Metis, Aurora
   and Fantom — the 22 curated chains, enabled by default — plus 65
   more, one wallet, one address per chain, one recovery phrase.
   (Evidence: `SUPPORTED_CHAINS` in `apps/web/src/wallet/chains.ts`,
   87 entries; the full 87-chain set is specified in
   `docs/CREATE-THIS-SPEC.md` §2.)
3. **A fresh address for every payment.** The Receive card always shows
   your next unused address, and you can make a new receiving address at
   any time. (Evidence: HD rotation, `apps/web/src/screens/receive.tsx`
   — "the QR card shows the receiving address for this account, derived
   from the next unused index".)
4. **Real numbers only.** Balances come from public blockchains and prices
   in US dollars from CoinGecko. A zero balance shows as zero; a value the
   wallet could not check says so instead of showing a made-up number.
   (Evidence: `apps/web/src/wallet/prices.ts` — CoinGecko public API;
   "Powered by CoinGecko" on the dashboard.)
5. **Watch any wallet without risking it.** Paste an extended public key
   (xpub) and follow a wallet's balances and history watch-only. A
   watch-only account can never sign or spend — no private key is stored
   here. (Evidence: Import screen copy in
   `apps/web/src/screens/import-wallet.tsx`.)
6. **Safe by default.** Sending funds is switched off on mainnet until it
   is separately approved. Signing happens offline on this device, and the
   broadcast stays disabled until separately authorised — so a bug, a bad
   link or a stolen session cannot move your money. (Evidence:
   `apps/web/src/wallet/send.ts` — "broadcast stays DISABLED until
   separately authorised".)
7. **Nothing to install, nothing to sign up for.** It runs in the browser.
   No account, no sign-up, no subscription, no analytics in the app.
8. **Open source, MIT licensed.** Read the code or build it yourself.
   (Evidence: `LICENSE` — MIT, "Bawa HD Wallet contributors".)
9. **Built from the guide, in the open.** This wallet is the wallet the
   Bawa guide builds — the same repository holds the guide
   (`docs/01-fundamentals` … `docs/16-security-decision-guide`) and the
   working wallet, so every claim about how it works can be checked
   against the instructions that built it.

## What it does not do — said plainly

A wallet that hides its limits is not trustworthy. Bawa today:

- **Cannot send funds on mainnet.** Sending is switched off until it is
  separately approved. The Send flow prepares and signs offline only;
  nothing in it sends cryptocurrency anywhere.
- **No swaps, no staking, no buying crypto, no dApp browser.** If you
  need those, use a wallet that has them — Bawa does not pretend to.
- **No recovery if you lose your phrase.** Lose the 24 words and the
  device, and the funds are gone. No support team can restore them —
  that is the other side of nobody holding your keys.
- **Prices and history depend on public services.** Balances come from
  public RPCs and prices from CoinGecko; when those services rate-limit
  a request, some values are temporarily unavailable instead of guessed.
  A fresh wallet still shows its real (zero) balances.

## How this differs from the wallets people already know

The presentation was checked against how MetaMask, Trust Wallet and
BlueWallet present themselves (their public homepages and store listings,
November 2026). The pattern they share: the headline states who holds the
keys, the chain count is proof, and the limits are stated honestly
("Your keys, your bitcoin" — BlueWallet; "The crypto wallet you control"
— Trust Wallet; keys stored locally, never on company servers —
MetaMask). Bawa follows the same pattern and differs in one place that
matters: **it is safe by default in a way the others are not** — sending
is off, not on. That is the honest answer to "why choose this wallet over
those": you choose it when you want a wallet that can receive, watch and
track across 87 chains while being unable, by construction, to send your
money away — and you can read the code that makes that true.

## Words to use / words to avoid

Use: self-custodial, your keys, one recovery phrase, 87 chains (22 enabled by default), real
balances, real prices, watch-only, safe by default, sending switched off,
open source, no account.

Avoid: "designed in our studio", "handmade", "small-batch", "limited
runs" (maker claims — Wulu standing rule, same honesty bar); "bank-grade",
"military-grade", "unhackable", "guaranteed safe" (unprovable); "free
money", "earn", "rewards" (there is no earning feature); "supports
every chain" (it supports 87 — name the curated 22).

## Proof points (for Lane 4 — cite these, not adjectives)

| Claim | Evidence in this repo |
|---|---|
| 87 chains (22 enabled by default) | `SUPPORTED_CHAINS`, `apps/web/src/wallet/chains.ts` |
| 24-word BIP-39 phrase, 256-bit entropy | `apps/web/src/wallet/core.ts` |
| BIP-32 HD derivation | `@scure/bip32` via `apps/web/src/wallet/core.ts` |
| Prices in USD from CoinGecko | `apps/web/src/wallet/prices.ts` |
| Broadcast disabled on mainnet | `apps/web/src/wallet/send.ts` |
| MIT licence | `LICENSE` |
| Add a chain or a token by contract address | `apps/web/src/screens/add-token.tsx` |
| Track any transaction by hash | `/track` route, `apps/web/src/app/app.tsx` |
| QR templates on Receive (Address / Payment request / Share link) | `apps/web/src/screens/receive.tsx` (Lane 7) |

## What changed in the app for this (Lane 3, 2026-11-23)

- Welcome screen leads with the wallet, not the guide; the guide
  sentence stays, demoted to one line. The capability list now says
  what *this* wallet does (receive on 22 chains, fresh addresses, real
  balances and prices, watch-only, add tokens) instead of advertising
  Android-wallet and smart-contract creation, which this app does not do.
- Welcome carries both ways in: a Create a wallet card next to Import
  (reversing Lane C item 9, which had removed it — a fresh user choosing
  a wallet must be able to start from the first screen).
- Create screen: the Multichain wallet and HD wallet cards were the same
  wallet and the same setup, so they are one card now — "Create a
  wallet", stating the 22-chain scope the old cards understated as four
  chains. The cryptic "Creating a wallet here does not replace your
  dashboard." line is gone.
- Dashboard hero tagline is now factual ("The total value of your coins,
  in US dollars.") instead of the joke ("Your coins, drawn to scale.
  Almost.").
- Send step 1 no longer says "Only networks with a wallet here can
  send." — it says sending is switched off and the flow signs offline
  only, matching the banner above it.
- Nothing in the Partial/Retry logic (Lane 1) or the QR templates
  (Lane 7) was touched.

## Note — 2026-11-26 (guide-update pass)

Chain count corrected 22 → 87 throughout (22 curated chains enabled
by default, plus 65 expansion chains). The two "What changed in the app
for this (Lane 3, 2026-11-23)" bullets that say "22 chains" are Lane 3's
record of what the app did then and are left as written; the live
wording above is the 87-chain wording.
