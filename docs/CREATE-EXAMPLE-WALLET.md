# Create the example web wallet

_Last verified: 2026-11-23, from a clean checkout of `panel-rebuild/readme-showcase-token` at `bded0df` (Node v22.23.4; `npm ci` exit 0; `npm run build` exit 0; preview served the app and the Welcome screen rendered in headless Chromium)._

## What you will have

A running copy of the Bawa example web wallet on your machine. It is a fully
functional example wallet built using this guide, and it runs entirely in the
browser. You can create a wallet, import one, or add a watch-only wallet, and
see real balances for its 22 chains. Broadcast stays disabled, so the wallet
cannot send funds. Never fund it with real money.

## Prerequisites

| Requirement | Version | Check |
| --- | --- | --- |
| Node.js | 22 (`22.23.4` verified) | `node --version` |
| npm | bundled with Node 22 | `npm --version` |
| Git | any recent version | `git --version` |
| A modern browser | Chrome, Firefox, Safari, or Edge | Open any website |

No account, no API key, and no funds are needed. Everything runs locally;
balances come from public read-only endpoints.

## Steps

### Step 1: Clone the repository

```sh
git clone --branch panel-rebuild/token-gaps https://github.com/Pr3eve6ti2o/bawa.git
cd bawa
```

Expected: a `bawa` directory with `apps/web` inside it.

### Step 2: Install the dependencies

```sh
cd apps/web
npm ci
```

Expected: npm installs with no errors. Node other than 22 fails here with
`EBADENGINE`, because `apps/web/.npmrc` sets `engine-strict=true`.

### Step 3: Build the wallet

```sh
npm run build
```

Expected: the build passes (type check, then Vite build) and creates `dist/`.
The build also copies the wallet-core WASM file and checks its SHA-256
against the pinned `@trustwallet/wallet-core` 4.9.3 release.

### Step 4: Run it

```sh
npm run preview
```

Expected: Vite preview serves the built app at `http://localhost:4173`.
For development with hot reload, run `npm run dev` instead and open
`http://localhost:5173`.

### Step 5: Open it in the browser

Open `http://localhost:4173`. You should see the Welcome screen, with
options to create a wallet, import one, or add a watch-only wallet. Create
a fresh wallet, write the 24-word phrase down on paper, and the dashboard
opens with 22 native assets plus 21 default tokens (43 rows). A balance
shows as unavailable when its provider cannot be reached; it is never
shown as an invented figure.

## Verify it works

| Check | Command | Expected result |
| --- | --- | --- |
| Build passes | `npm run build` | Exit `0`, `dist/index.html` exists |
| Preview serves the app | `curl -s -L -o /dev/null -w "%{http_code}" http://localhost:4173/` | `200` (the preview root redirects to `/bawa/`, so follow it with `-L`) |
| App mounts | Open `http://localhost:4173` in a browser | Welcome screen with Create, Import, and watch-only options |
| Wallet engine loads | `curl -s -o /dev/null -w "%{http_code}" http://localhost:4173/bawa/wallet-core.wasm` | `200` |

## Troubleshooting

### `EBADENGINE` when running `npm ci`

Node is not version 22. Switch to Node `22.23.4` and run `npm ci` again.

### Port `4173` is already in use

Stop the other preview server, or run the preview on another port and open
that port instead:

```sh
npm run preview -- --port 4174
```

### `npm ci` fails on the network

Check your network connection and run `npm ci` again. No other step can
proceed until the install succeeds.

## Safety

- Never fund this wallet with real money. Broadcast is disabled; it cannot
  send funds.
- Never import a phrase that holds real funds. Create a fresh wallet for
  testing and delete the vault afterwards. The lifecycle is documented in
  [docs/wallet-lifecycle.md](wallet-lifecycle.md).
- Secrets never leave the browser.

## What to read next

- [README](../README.md) — what Bawa is, and the note on the 22 chains
  this wallet enables versus the 168 chains the guide covers.
- [Guide index](index.md) — the full guide.
- [Web starter README](../apps/web/README.md) — what works, what is mock,
  and the security notes.
- [Wallet lifecycle](wallet-lifecycle.md) — cold-test the wallet safely,
  then delete the vault.
