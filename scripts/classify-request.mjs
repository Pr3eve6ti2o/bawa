// classify-request.mjs — request classification for the one-prompt
// workflow (extracted from scripts/build-wallet.mjs, F-20/21/22/31).
// Pure functions: no I/O, no process state. Exported for unit testing.
//
// Return shapes from classifyRequest(request):
//   { profile: <profile id> }            — routed to a profile
//   { ambiguous: 'split' }               — web + Android in one request
//   { unclassifiable: true, reason }     — no profile matches (F-20)
//
// findRefusal(request) returns the exact refusal sentence from
// ai/request-routing.md ("Unsupported requests") or null. Checked
// BEFORE classification (F-31).

const NEGATORS = ['without', 'no', 'not', 'never'];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function word(token, text) {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text);
}

// negated(token, request): true when `token` appears in `request` as a
// whole word/phrase and a negator (without/no/not/never) appears as a
// whole word within ~30 characters before that occurrence, in the same
// span (F-22). Matching is case-insensitive.
export function negated(token, request) {
  const text = request.toLowerCase();
  const pattern = new RegExp(
    `\\b${escapeRegExp(token.toLowerCase())}\\b`,
    'g',
  );
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const windowStart = Math.max(0, match.index - 30);
    const window = text.slice(windowStart, match.index);
    if (NEGATORS.some((negator) => word(negator, window))) return true;
  }
  return false;
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

export function classifyRequest(request) {
  const lower = request.toLowerCase();
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
  if (hasWeb && hasAndroid) {
    return { ambiguous: 'split' };
  } else if (hasAndroid) {
    return { profile: 'android-wallet' };
  } else if (hasWeb) {
    return { profile: 'web-wallet' };
  } else if (word('multi-chain', lower) || word('multichain', lower)) {
    return { profile: 'multichain-wallet' };
  } else if (
    word('hd', lower) ||
    lower.includes('hierarchical deterministic') ||
    word('cli', lower) ||
    lower.includes('command-line') ||
    lower.includes('command line')
  ) {
    return { profile: 'hd-wallet-cli' };
  } else if (word('bitcoin', lower) || word('btc', lower)) {
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
      return { profile: 'watch-only-wallet' };
    }
    return { profile: 'bitcoin-wallet' };
  } else if (word('evm', lower) || word('ethereum', lower) || word('eth', lower)) {
    return { profile: 'evm-wallet' };
  } else if (hasWatchOnly) {
    return { profile: 'watch-only-wallet' };
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
  'I cannot claim signing or broadcast support without an engine that implements them; no signing or broadcast code exists in this repository.';
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
  if (hasTon && requested('send', request)) return REFUSAL_TON_SEND;

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
    (word('send', lower) && !negated('send', request));
  if (wantsSigning) return REFUSAL_SIGNING;

  // 4. Mainnet.
  if (requested('mainnet', request)) return REFUSAL_MAINNET;

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
