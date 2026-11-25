// Smart address detection + recipient security checks (UX-major Lane 3,
// 2026-11-26, hands-on, 0 Sol calls).
//
// What this is: pure, synchronous, offline format detection for the
// address a user pastes into the Send recipient field, plus the three
// recipient checks that need no network and no new data:
//
//   1. detection — what the pasted value looks like (EVM 0x, Solana
//      base58, BTC bech32/base58, TRON, TON, …) and whether it belongs
//      to the network this send is on;
//   2. secrets — a pasted recovery phrase or private key is never a
//      recipient address, and is warned about, never sent anywhere;
//   3. self-send / contract-send — sending to your own address, or to
//      the selected token's own contract address (which would lose the
//      tokens), is called out before Review.
//
// What this is NOT, stated plainly:
//   - A 0x address is the same address on all 59 EVM chains, so chain
//     auto-detection from a bare 0x address is IMPOSSIBLE — the module
//     says "the same address on all 59 EVM chains" instead of guessing
//     one. Chain auto-detection from a bare address only exists for
//     formats that belong to exactly one chain (bc1 → Bitcoin, T… →
//     TRON, UQ/EQ → TON, bare base58 32–44 → Solana, …).
//   - This is format detection, not validation: whether the address is
//     valid on the selected chain is still decided by
//     validateRecipient (Wallet Core) on blur/paste/Review. A detection
//     line never blocks, and never approves, a send.
//   - No scam list exists for recipient addresses anywhere in this
//     repo (verified by grep: no scam/blocklist/denylist data; the
//     Jupiter banned list covers token mints only, and is checked by
//     isBannedToken in token-verification.ts). Nothing here calls an
//     address a scam — the warnings are all derived from the pasted
//     value itself, the selected chain, and the registry data the
//     screen already holds.
//   - No contract is resolved here: resolving an arbitrary pasted
//     contract needs the async trusted-list lookup
//     (resolveTokenListVerification), which the Add Token dialog
//     already runs with its CoinGecko-first flow. The one contract
//     check that IS local — recipient equals the selected token's own
//     contract — is in describeRecipientDetection.
//
// Layering: detectWatchOnlyChain lives in screens/import-wallet.tsx
// and is a thin translation of detectAddressFormat (UX-major Lane 7
// merge, 2026-11-26) — the format table exists once, here. This
// module does NOT import from a screen. The translation preserves the
// legacy watch-only readings exactly (0x -> eth, bare base58 -> null,
// 0x + 64 hex -> aptos); see the differential test.
import type { ChainId } from '../engine/boundary';
import type { TokenRecord } from './tokens';

/** The EVM chains sharing one 0x address (watch-only-families: the
    fifty-nine 0x EVM chains). Hardcoded in the copy, with a unit test
    asserting EVM_WATCH_CHAINS.length stays 59, so a family change
    fails the test instead of silently shipping a stale number. */
export const EVM_CHAIN_COUNT = 59;

/** What a pasted value looks like, by shape alone. */
export type AddressFormat =
  | { kind: 'evm' }
  | { kind: 'chain'; chain: ChainId; label: string }
  | { kind: 'secret'; secret: 'private-key' | 'mnemonic' };

const BASE58 = '1-9A-HJ-NP-Za-km-z';

// One-chain formats, most specific first. A bare 0x address is NOT in
// this table — it belongs to all 59 EVM chains at once (see above) —
// and bare base58 32–44 chars is last: it is Solana only once every
// prefixed form above it has failed to match.
const CHAIN_PATTERNS: ReadonlyArray<readonly [RegExp, ChainId, string]> = [
  [/^bc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,}$/, 'btc', 'Bitcoin'],
  [/^1[1-9A-HJ-NP-Za-km-z]{25,34}$/, 'btc', 'Bitcoin'],
  [/^ltc1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{11,}$/, 'ltc', 'Litecoin'],
  [/^L[1-9A-HJ-NP-Za-km-z]{25,34}$/, 'ltc', 'Litecoin'],
  [/^D[1-9A-HJ-NP-Za-km-z]{25,34}$/, 'doge', 'Dogecoin'],
  [/^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'trx', 'TRON'],
  [/^(UQ|EQ)[0-9A-Za-z_-]{46}$/, 'ton', 'TON'],
  [/^0:[0-9a-fA-F]{64}$/, 'ton', 'TON'],
  [/^cosmos1[0-9a-z]{38}$/, 'cosmos', 'Cosmos Hub'],
  [/^osmo1[0-9a-z]{38}$/, 'osmosis', 'Osmosis'],
  [/^inj1[0-9a-z]{38}$/, 'injective', 'Injective'],
  [/^celestia1[0-9a-z]{38}$/, 'celestia', 'Celestia'],
  [/^dydx1[0-9a-z]{38}$/, 'dydx', 'dYdX'],
  [/^sei1[0-9a-z]{38}$/, 'seicosmos', 'Sei'],
  [/^axelar1[0-9a-z]{38}$/, 'axelar', 'Axelar'],
  [/^noble1[0-9a-z]{38}$/, 'noble', 'Noble'],
  [/^juno1[0-9a-z]{38}$/, 'juno', 'Juno'],
  [/^r[0-9A-HJ-NP-Za-km-z]{24,34}$/, 'xrp', 'XRP Ledger'],
  [/^f1[1-9a-z]{37}$/, 'filecoin', 'Filecoin'],
  [/^ronin:[0-9a-fA-F]{40}$/, 'ronin', 'Ronin'],
  [/^G[A-Z0-9]{55}$/, 'stellar', 'Stellar'],
  [/^tz1[1-9A-HJ-NP-Za-km-z]{33}$/, 'tezos', 'Tezos'],
  [/^0\.0\.\d+$/, 'hedera', 'Hedera'],
  // Polkadot SS58 starts with '1' like Bitcoin P2PKH, but is 48
  // chars — Bitcoin tops out at 35. Length disambiguates.
  [/^1[1-9A-HJ-NP-Za-km-z]{47}$/, 'polkadot', 'Polkadot'],
  [new RegExp(`^[${BASE58}]{32,44}$`), 'sol', 'Solana'],
];

/** Shape of one pasted value, or null when it matches no known form.
    A null is not an error — the validator still decides. */
export function detectAddressFormat(value: string): AddressFormat | null {
  const input = value.trim();
  if (input === '') return null;
  // A recovery phrase: 12/15/18/21/24 lowercase words. Checked first —
  // a phrase must never be mistaken for an address.
  const words = input.split(/\s+/);
  if (
    (words.length === 12 ||
      words.length === 15 ||
      words.length === 18 ||
      words.length === 21 ||
      words.length === 24) &&
    words.every((word) => /^[a-z]+$/i.test(word))
  ) {
    return { kind: 'secret', secret: 'mnemonic' };
  }
  // A 64-hex string is a 32-byte private key. (A 0x-prefixed one is
  // also an Aptos address shape — in a recipient field the safe
  // reading wins: it is warned about as a key, never sent anywhere.)
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(input)) {
    return { kind: 'secret', secret: 'private-key' };
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(input)) return { kind: 'evm' };
  for (const [pattern, chain, label] of CHAIN_PATTERNS) {
    if (pattern.test(input)) return { kind: 'chain', chain, label };
  }
  return null;
}

/** Same account, two spellings: exact, 0x case-insensitive, or
    ronin:0x… versus bare 0x… (Ronin stores the prefixed form).
    Exported for the review screen's self-send note. */
export function isSameAddress(a: string, b: string): boolean {
  const left = a.trim();
  const right = b.trim();
  if (left === right) return true;
  const stripRonin = (value: string): string =>
    value.startsWith('ronin:') ? value.slice('ronin:'.length) : value;
  const l = stripRonin(left);
  const r = stripRonin(right);
  return (
    l.startsWith('0x') && r.startsWith('0x') && l.toLowerCase() === r.toLowerCase()
  );
}

export type RecipientDetection =
  | { tone: 'info'; text: string }
  | { tone: 'warn'; text: string };

/**
 * The one detection line for the Send recipient field, or null when
 * the value says nothing yet. Advisory only: it never blocks Review
 * and never approves a send — validateRecipient still decides.
 * Every branch is derived from the value, the selected chain, the
 * sender, and the selected token's contract — no network, no guess.
 */
export function describeRecipientDetection(input: {
  value: string;
  chain: ChainId;
  chainName: string;
  chainIsEvm: boolean;
  from: string;
  tokenContract?: string;
  tokenSymbol?: string;
}): RecipientDetection | null {
  const value = input.value.trim();
  if (value === '') return null;
  const format = detectAddressFormat(value);
  if (format !== null && format.kind === 'secret') {
    return format.secret === 'mnemonic'
      ? {
          tone: 'warn',
          text: 'This looks like a recovery phrase. Never paste it here — anyone with it controls your wallet.',
        }
      : {
          tone: 'warn',
          text: 'This looks like a private key. Never paste a private key here — it is not a recipient address.',
        };
  }
  if (input.from !== '' && isSameAddress(value, input.from)) {
    return { tone: 'info', text: 'This is your own address.' };
  }
  if (
    input.tokenContract !== undefined &&
    input.tokenContract !== '' &&
    isSameAddress(value, input.tokenContract)
  ) {
    return {
      tone: 'warn',
      text: `This is the ${input.tokenSymbol ?? 'token'} contract address, not a wallet. Sending here would lose the tokens.`,
    };
  }
  if (format === null) return null;
  // One shared mismatch sentence: the two call sites differ only in
  // the label, article included ("an Ethereum (0x)" vs "a Bitcoin").
  const mismatch = (label: string): RecipientDetection => ({
    tone: 'warn',
    text: `Looks like ${label} address, but this send is on ${input.chainName}. Check the network before continuing.`,
  });
  if (format.kind === 'evm') {
    if (!input.chainIsEvm) {
      return mismatch('an Ethereum (0x)');
    }
    if (input.chain === 'ronin') {
      return {
        tone: 'warn',
        text: 'This is a bare 0x address. Ronin addresses start with ronin: — check the address before sending.',
      };
    }
    return {
      tone: 'info',
      text: `Detected: 0x address — the same address on all ${EVM_CHAIN_COUNT} EVM chains.`,
    };
  }
  if (format.chain === input.chain) {
    return { tone: 'info', text: `Detected: ${format.label} address.` };
  }
  return mismatch(`a ${format.label}`);
}

/**
 * Copycat check, local only: the token is unverified AND a verified
 * token on the same chain shares its name or symbol under a different
 * contract. Identity is chain + contract, never name/symbol — this
 * function only reports that a namesake exists, so the screen can
 * tell the user to check the contract address. Returns the verified
 * namesake's name/symbol, or null.
 */
export function findVerifiedNamesake(
  token: Pick<TokenRecord, 'chain' | 'contract' | 'name' | 'symbol' | 'verifiedSource'>,
  registry: ReadonlyArray<
    Pick<TokenRecord, 'chain' | 'contract' | 'name' | 'symbol' | 'verifiedSource'>
  >,
): { name: string; symbol: string } | null {
  if (token.verifiedSource !== undefined && token.verifiedSource !== null) {
    return null;
  }
  const symbol = token.symbol.toLowerCase();
  const name = token.name.toLowerCase();
  for (const entry of registry) {
    if (entry.chain !== token.chain) continue;
    if (entry.verifiedSource === undefined || entry.verifiedSource === null) {
      continue;
    }
    if (entry.contract.toLowerCase() === token.contract.toLowerCase()) {
      continue;
    }
    if (
      entry.symbol.toLowerCase() === symbol ||
      entry.name.toLowerCase() === name
    ) {
      return { name: entry.name, symbol: entry.symbol };
    }
  }
  return null;
}

/** Shorten an address for display (6…4, the tokens.ts contract
    convention). Short values are shown whole. The full value is
    always kept alongside — a shortened address is never the only
    copy. */
export function shortenAddress(value: string): string {
  return value.length <= 13
    ? value
    : `${value.slice(0, 6)}…${value.slice(-4)}`;
}
