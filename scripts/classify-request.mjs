// classify-request.mjs — request classification for the one-prompt
// workflow (extracted from scripts/build-wallet.mjs, F-20/21/22/31).
// Exported for unit testing. The matching helpers are pure; the
// chain/profile check (PR2 Lane C) reads the profile chains from
// registry/profiles.json — never hard-coded — via loadProfiles(), unless
// the caller passes the profiles array in.
//
// Return shapes from classifyRequest(request, profiles?):
//   { profile: <profile id> }            — routed to a profile
//   { ambiguous: 'split' }               — web + Android in one request
//   { unclassifiable: true, reason }     — no profile matches (F-20), or
//     the request names a chain the matched profile does not support
//     (PR2: "Build a web wallet for Solana" is unclassifiable, not
//     web-wallet — the web-wallet profile has no Solana support)
//
// findRefusal(request) returns the exact refusal sentence from
// ai/request-routing.md ("Unsupported requests") or null. Checked
// BEFORE classification (F-31).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function word(token, text) {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text);
}

// Clause separators: a negator stops applying at a clause boundary.
// T46: the 30-character window alone let a negator from an unrelated
// clause suppress a refusal ("with no ads, mainnet support" escaped
// the mainnet refusal; "with no fees, send BTC" escaped the send
// refusal). A negator counts only when no separator intervenes between
// it and the token. "or" is deliberately NOT a separator: "without
// secrets or signing" is one coordinated negation.
const SEPARATOR = /[,;:!?.\r\n\u2014\u2013]|\bbut\b/;

// occurrenceNegated(text, tokenIndex): true when a negator word
// (without/no/not/never) appears as a whole word within ~30 characters
// before this occurrence, in the same clause (F-22, T46). Matching is
// case-insensitive; `text` must already be lower-cased.
function occurrenceNegated(text, tokenIndex) {
  const windowStart = Math.max(0, tokenIndex - 30);
  const windowText = text.slice(windowStart, tokenIndex);
  const negatorPattern = /\b(without|no|not|never)\b/g;
  let negatorMatch;
  while ((negatorMatch = negatorPattern.exec(windowText)) !== null) {
    const afterNegator = windowText.slice(
      negatorMatch.index + negatorMatch[0].length,
    );
    if (!SEPARATOR.test(afterNegator)) return true;
  }
  return false;
}

// negated(token, request): true when `token` appears in `request` and
// EVERY occurrence is scoped-negated. An affirmative occurrence must
// still count (T46): "send BTC, no send on mainnet" is a send request.
export function negated(token, request) {
  const text = request.toLowerCase();
  const pattern = new RegExp(
    `\\b${escapeRegExp(token.toLowerCase())}\\b`,
    'g',
  );
  let match;
  let found = false;
  while ((match = pattern.exec(text)) !== null) {
    found = true;
    if (!occurrenceNegated(text, match.index)) return false;
  }
  return found;
}

// A token counts as requested only when it appears and is not negated.
function requested(token, request) {
  const text = request.toLowerCase();
  return word(token, text) && !negated(token, request);
}

function requestedPhrase(phrase, request) {
  const text = request.toLowerCase();
  return text.includes(phrase) && !negated(phrase, request);
}

// T46: outgoing-transaction synonyms for "send". A synonym counts only
// when a value/recipient word appears within ~30 characters, so "file
// transfer" or "pay attention" do not trigger the signing refusal,
// while "transfer BTC", "pay friends in BTC" and "withdraw BTC" do.
const SEND_SYNONYMS = [
  'transfer', 'transfers', 'transferring', 'transferred',
  'pay', 'pays', 'paying', 'paid',
  'withdraw', 'withdraws', 'withdrawing', 'withdrawal', 'withdrawals',
];
const SEND_VALUE_WORDS = [
  'btc', 'bitcoin', 'eth', 'ethereum', 'trx', 'tron', 'ton',
  'funds', 'coins', 'tokens', 'money', 'crypto',
  'friends', 'someone', 'address',
];

function sendSynonymRequested(request) {
  const text = request.toLowerCase();
  for (const synonym of SEND_SYNONYMS) {
    const pattern = new RegExp(`\\b${escapeRegExp(synonym)}\\b`, 'g');
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (occurrenceNegated(text, match.index)) continue;
      const context = text.slice(
        Math.max(0, match.index - 30),
        Math.min(text.length, match.index + match[0].length + 30),
      );
      if (SEND_VALUE_WORDS.some((value) => word(value, context))) return true;
    }
  }
  return false;
}

// T46: EVM chains outside the evm-wallet profile's ETH-only scope.
// A request naming one must not silently route to evm-wallet (the
// routing doc: ask a clarifying question when a non-ETH chain is
// named; the CLI cannot ask, so it fails closed as unclassifiable).
// "base" is covered only as a chain phrase: bare "base" false-positives
// on "base fee".
const NON_ETH_EVM_CHAINS = [
  'polygon', 'matic', 'bsc', 'binance smart chain', 'bnb chain',
  'bnb smart chain', 'arbitrum', 'optimism', 'base chain', 'base network',
  'avalanche', 'avax', 'fantom', 'gnosis', 'celo',
  'zksync', 'linea', 'scroll', 'mantle', 'blast', 'cronos',
  'moonbeam', 'moonriver', 'metis', 'sei', 'kava', 'harmony',
  'mode', 'taiko', 'injective', 'zkevm', 'polygon zkevm',
];

// PR2 Lane C: chain names recognised in plain-language requests, mapped
// to the registry chain id. The map covers the chains the builder can
// build (btc/eth/trx/ton) plus recognised real chains no profile
// supports (solana, cosmos, ...) so a request naming one fails closed
// instead of routing to a profile that cannot build for it.
//
// Deliberately NOT bare words: 'base' (only 'base chain' / 'base
// network' — bare "base" false-positives on "base fee"), 'mode',
// 'scroll', 'blast', 'harmony' (ordinary English words in wallet
// requests — "dark mode", "smooth scroll"), 'near' (only the 'near
// protocol' phrase), 'dot' (polkadot is covered; bare "dot" is not a
// chain mention), 'apt' (aptos is covered; bare "apt" is an English
// word). The evm branch's NON_ETH_EVM_CHAINS check still covers
// scroll/blast/harmony/mode when the request names Ethereum/EVM.
export const CHAIN_NAME_TO_ID = {
  bitcoin: 'btc',
  btc: 'btc',
  ethereum: 'eth',
  eth: 'eth',
  ether: 'eth',
  tron: 'trx',
  trx: 'trx',
  ton: 'ton',
  solana: 'solana',
  sol: 'solana',
  cosmos: 'cosmos',
  atom: 'cosmos',
  dogecoin: 'doge',
  doge: 'doge',
  litecoin: 'ltc',
  ltc: 'ltc',
  cardano: 'ada',
  ada: 'ada',
  polkadot: 'dot',
  ripple: 'xrp',
  xrp: 'xrp',
  stellar: 'xlm',
  xlm: 'xlm',
  monero: 'xmr',
  xmr: 'xmr',
  zcash: 'zec',
  zec: 'zec',
  avalanche: 'avax',
  avax: 'avax',
  polygon: 'polygon',
  matic: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
  bsc: 'bsc',
  'binance smart chain': 'bsc',
  'bnb chain': 'bsc',
  'bnb smart chain': 'bsc',
  'base chain': 'base',
  'base network': 'base',
  fantom: 'fantom',
  gnosis: 'gnosis',
  celo: 'celo',
  zksync: 'zksync',
  linea: 'linea',
  mantle: 'mantle',
  cronos: 'cronos',
  moonbeam: 'moonbeam',
  moonriver: 'moonriver',
  metis: 'metis',
  sei: 'sei',
  kava: 'kava',
  taiko: 'taiko',
  injective: 'injective',
  zkevm: 'zkevm',
  'polygon zkevm': 'zkevm',
  sui: 'sui',
  aptos: 'aptos',
  hedera: 'hbar',
  hbar: 'hbar',
  algorand: 'algo',
  algo: 'algo',
  tezos: 'xtz',
  xtz: 'xtz',
  filecoin: 'fil',
  fil: 'fil',
  'internet computer': 'icp',
  icp: 'icp',
  'near protocol': 'near',
};

// extractChains(request): the chain ids named (non-negated) in the
// request, in map order, deduplicated. Used by the classifyRequest
// chain check and by build-wallet.mjs to build the planner input.
export function extractChains(request) {
  const found = [];
  for (const [name, id] of Object.entries(CHAIN_NAME_TO_ID)) {
    const named = name.includes(' ')
      ? requestedPhrase(name, request)
      : requested(name, request);
    if (named && !found.includes(id)) found.push(id);
  }
  return found;
}

// The registry profiles, read from registry/profiles.json relative to
// this module (never hard-coded). Cached after the first read; null
// when the file cannot be read, in which case the chain check is
// skipped (build-wallet.mjs fails closed earlier via validateAll;
// direct callers keep the previous routing behaviour).
let cachedProfiles;
function loadProfiles() {
  if (cachedProfiles !== undefined) return cachedProfiles;
  cachedProfiles = null;
  try {
    const profilesPath = join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      'registry',
      'profiles.json',
    );
    const parsed = JSON.parse(readFileSync(profilesPath, 'utf8'));
    if (Array.isArray(parsed)) cachedProfiles = parsed;
  } catch {
    // Registry unreadable: skip the chain check (see above).
  }
  return cachedProfiles;
}

// withChainCheck(result, request, profiles): fail-closed wrapper for a
// { profile } classification. If the request names a chain the matched
// profile does not support (per its registry `chains`), the request is
// unclassifiable, with a reason naming the chain, the profile and the
// profile's supported chains. Ambiguous / unclassifiable results and
// requests naming no chain pass through unchanged.
function withChainCheck(result, request, profiles) {
  if (!result.profile || !Array.isArray(profiles)) return result;
  const profile = profiles.find((entry) => entry?.id === result.profile);
  const supported = Array.isArray(profile?.chains) ? profile.chains : null;
  if (!supported) return result;
  const named = extractChains(request);
  const unsupported = named.filter((chain) => !supported.includes(chain));
  if (unsupported.length === 0) return result;
  return {
    unclassifiable: true,
    reason: `chain '${unsupported.join(', ')}' requested but not supported by the ${result.profile} profile (supported chains: ${supported.join(', ')})`,
  };
}

export function classifyRequest(request, profiles) {
  const lower = request.toLowerCase();
  // The profiles to check named chains against: the caller's array, or
  // the registry when the caller passes none. Chain lists are never
  // hard-coded here.
  const registryProfiles = profiles ?? loadProfiles();
  // Short tokens match as whole words only: substring matching would
  // false-positive ("eth" inside "something", "cli" inside "click").
  const hasWeb =
    requested('web', request) ||
    requested('website', request) ||
    requested('browser', request);
  const hasAndroid = requested('android', request);
  const hasWatchOnly =
    requestedPhrase('watch-only', request) ||
    requestedPhrase('watch only', request) ||
    requested('xpub', request) ||
    requestedPhrase('extended public key', request);

  // Classification, ordered, first match wins. No "wallet" word required.
  // Every single-profile return goes through the chain check (PR2 Lane C);
  // ambiguous and unclassifiable returns are untouched.
  if (hasWeb && hasAndroid) {
    return { ambiguous: 'split' };
  } else if (hasAndroid) {
    return withChainCheck({ profile: 'android-wallet' }, request, registryProfiles);
  } else if (hasWeb) {
    return withChainCheck({ profile: 'web-wallet' }, request, registryProfiles);
  } else if (word('multi-chain', lower) || word('multichain', lower)) {
    return withChainCheck({ profile: 'multichain-wallet' }, request, registryProfiles);
  } else if (
    requested('hd', request) ||
    requestedPhrase('hierarchical deterministic', request) ||
    requested('cli', request) ||
    requestedPhrase('command-line', request) ||
    requestedPhrase('command line', request)
  ) {
    return withChainCheck({ profile: 'hd-wallet-cli' }, request, registryProfiles);
  } else if (
    (requested('bitcoin', request) || requested('btc', request)) &&
    (requested('evm', request) || requested('ethereum', request) || requested('eth', request))
  ) {
    return { ambiguous: 'split' };
  } else if (requested('bitcoin', request) || requested('btc', request)) {
    const generationLanguage =
      lower.includes('generat') ||
      lower.includes('mnemonic') ||
      lower.includes('seed') ||
      lower.includes('recovery') ||
      lower.includes('recover') ||
      word('cli', lower) ||
      lower.includes('command-line') ||
      lower.includes('command line');
    // F-21: a Bitcoin request with watch-only language and no
    // generation language is a watch-only request, not ambiguous.
    if (hasWatchOnly && !generationLanguage) {
      return withChainCheck({ profile: 'watch-only-wallet' }, request, registryProfiles);
    }
    return withChainCheck({ profile: 'bitcoin-wallet' }, request, registryProfiles);
  } else if (requested('evm', request) || requested('ethereum', request) || requested('eth', request)) {
    // T46: a named non-ETH EVM chain fails closed instead of silently
    // routing to the ETH-only evm-wallet profile.
    const nonEthChain = NON_ETH_EVM_CHAINS.find((chain) =>
      chain.includes(' ')
        ? requestedPhrase(chain, request)
        : requested(chain, request),
    );
    if (nonEthChain) {
      return {
        unclassifiable: true,
        reason: `non-ETH EVM chain requested: ${nonEthChain}; the evm-wallet profile covers ETH derivation only`,
      };
    }
    return withChainCheck({ profile: 'evm-wallet' }, request, registryProfiles);
  } else if (hasWatchOnly) {
    return withChainCheck({ profile: 'watch-only-wallet' }, request, registryProfiles);
  }
  return { unclassifiable: true, reason: 'cannot classify request' };
}

// Refusal sentences, verbatim from ai/request-routing.md
// ("Unsupported requests"). Check order is prescribed (F-31).
const REFUSAL_TON_SEND =
  'I cannot provide TON send; TON is generation-only in the proposed multichain profile.';
const REFUSAL_TON_XPUB =
  'I cannot provide TON xpub support; the proposed TON scope has no xpub support.';
const REFUSAL_SIGNING =
  'I cannot claim signing or broadcast support for production use: the web wallet signs offline with real vault keys, but broadcast is not implemented, so no signed transaction can leave the device; the other signing code is a local, test-only signer restricted to temporary unfunded test credentials.';
const REFUSAL_MAINNET =
  'I cannot support mainnet use without separate approval; the default scope is testnet.';
const REFUSAL_SWAPS =
  'I cannot provide swaps, staking or bridges; they are out of scope for this programme.';
const REFUSAL_UNLISTED =
  'I cannot route this request to an unlisted profile; only the seven profiles listed here are eligible for routing.';

// Profile/type words that are NOT among the seven listed profiles.
// Used only for the unlisted-profile refusal: the request must name a
// wallet/profile AND one of these types. A bare "Build a wallet" with
// no type is unclassifiable, not a refusal. "mobile" is deliberately
// absent: it is not routed, but refusing it as unlisted would be wrong
// (the Android profile is the mobile profile).
const UNLISTED_TYPES = [
  'desktop',
  'hardware',
  'ios',
  'iphone',
  'extension',
  'ledger',
  'trezor',
  'mac',
  'windows',
  'linux',
];

export function findRefusal(request) {
  const lower = request.toLowerCase();
  const hasTon = word('ton', lower);

  // 1. TON send.
  if (hasTon && (requested('send', request) || sendSynonymRequested(request))) {
    return REFUSAL_TON_SEND;
  }

  // 2. TON xpub.
  if (
    hasTon &&
    (requested('xpub', request) ||
      requestedPhrase('extended public key', request))
  ) {
    return REFUSAL_TON_XPUB;
  }

  // 3. Generic sign/broadcast/send. "sign in" / "signing in" (and the
  // hyphenated forms) are login phrases, not cryptographic signing:
  // strip them before matching "sign".
  const signText = lower.replace(/sign(?:ing)?[\s-]in/g, ' ');
  const wantsSigning =
    (word('sign', signText) && !negated('sign', request)) ||
    (word('signing', signText) && !negated('signing', request)) ||
    (word('signature', signText) && !negated('signature', request)) ||
    (word('broadcast', lower) && !negated('broadcast', request)) ||
    (word('send', lower) && !negated('send', request)) ||
    sendSynonymRequested(request);
  if (wantsSigning) return REFUSAL_SIGNING;

  // 4. Mainnet. T46: normalise "main-net" / "main net" spellings so
  // they cannot evade the whole-word "mainnet" check; negation is
  // preserved because requested() still applies the negator rule.
  // The separator class covers Unicode hyphens too (U+2010-U+2014,
  // U+2212): "main‑net" with a non-breaking hyphen must not evade it.
  const normalized = lower.replace(/\bmain[\s\-\u2010\u2011\u2012\u2013\u2014\u2212]+net\b/g, 'mainnet');
  if (requested('mainnet', normalized)) return REFUSAL_MAINNET;

  // 5. Swaps, staking or bridges.
  if (
    requested('swap', request) ||
    requested('swaps', request) ||
    requested('staking', request) ||
    requested('stake', request) ||
    requested('bridge', request) ||
    requested('bridges', request)
  ) {
    return REFUSAL_SWAPS;
  }

  // 6. Unlisted profile: names a wallet/profile AND a type that is not
  // one of the seven listed profiles.
  if (
    (word('wallet', lower) || word('profile', lower)) &&
    UNLISTED_TYPES.some((type) => word(type, lower))
  ) {
    return REFUSAL_UNLISTED;
  }

  return null;
}
