// Generate the static chain facts in apps/web/src/wallet/chains.ts from
// registry/capabilities.json, the single static-metadata catalog.
//
// Usage (from apps/web):
//   node scripts/generate-chains.mjs           rewrite the generated block
//   node scripts/generate-chains.mjs --check   exit 1 when the block drifts
//
// The block lives between the BEGIN/END markers in chains.ts. If the
// markers are absent the script fails loudly naming them and refuses to
// invent a placement; the block is inserted by a separate step. Only the
// block between the markers is ever replaced; everything else in
// chains.ts is left byte-for-byte alone. No broadcast, no network access,
// no new dependency: plain node:fs only.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const BEGIN_MARKER =
  '// BEGIN GENERATED CHAIN FACTS — do not hand-edit. Regenerate with: node scripts/generate-chains.mjs';
export const END_MARKER = '// END GENERATED CHAIN FACTS';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(SCRIPT_DIR, '..');
const REPO_DIR = join(APP_DIR, '..', '..');
const REGISTRY_PATH = join(REPO_DIR, 'registry', 'capabilities.json');
const CHAINS_PATH = join(APP_DIR, 'src', 'wallet', 'chains.ts');

const REGENERATE_COMMAND = 'node scripts/generate-chains.mjs';

// Fields every coins entry must carry. slip44, registrySymbol and
// xpubVersion are deliberately not required: the registry omits slip44
// where it carries no value, and xpubVersion is null for TON and for
// prospective entries. The S5b lesson: a registry shape is only trusted
// when diffed against this file, never from memory.
const REQUIRED_FIELDS = [
  'registryId',
  'bawaChainId',
  'coinTypeName',
  'coinId',
  'symbol',
  'decimals',
  'curve',
  'derivationTemplate',
  'evmChainId',
  'status',
  'displayName',
  'networkId',
  'assetId',
  'profileId',
  'rpcEndpoints',
];

// The eight static facts the block emits per supported chain, in the
// order chains.ts already lists them (minus id, pathFor, capabilities,
// which stay hand-written).
const EMITTED_FIELDS = [
  'displayName',
  'symbol',
  'coinTypeName',
  'networkId',
  'assetId',
  'profileId',
  'rpcEndpoints',
  'evmChainId',
];

// ChainConfig.coinTypeName only admits the four supported chains. A
// supported registry entry naming anything else would emit TypeScript
// that fails tsc, so it fails loudly here instead.
const SUPPORTED_COIN_TYPE_NAMES = ['bitcoin', 'ethereum', 'tron', 'ton'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function label(key, field) {
  return `coins.${key}.${field}`;
}

// Validate every entry of the registry coins section. Returns the list of
// supported entries (status supported, bawaChainId non-null) in registry
// order. Collects every violation and throws one error naming each entry
// and field, instead of stopping at the first.
function validateCoins(registry) {
  const errors = [];
  const coins = registry?.coins;
  if (!isPlainObject(coins)) {
    throw new Error(
      'generate-chains: registry/capabilities.json coins: expected an object keyed by registry id',
    );
  }
  const keys = Object.keys(coins);
  if (keys.length === 0) {
    throw new Error(
      'generate-chains: registry/capabilities.json coins: expected at least one entry',
    );
  }
  const supported = [];
  const seenBawaChainIds = new Map();
  for (const key of keys) {
    const entry = coins[key];
    const entryLabel = `coins.${key}`;
    if (!isPlainObject(entry)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${entryLabel}: expected an object`,
      );
      continue;
    }
    for (const field of REQUIRED_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(entry, field)) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, field)}: missing required field`,
        );
      }
    }
    if (entry.registryId !== undefined) {
      if (!isNonEmptyString(entry.registryId)) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'registryId')}: expected a non-empty string`,
        );
      } else if (entry.registryId !== key) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'registryId')}: '${entry.registryId}' does not match the coins key '${key}'`,
        );
      }
    }
    if (entry.status !== undefined && !['supported', 'prospective'].includes(entry.status)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'status')}: '${entry.status}' is not 'supported' or 'prospective'`,
      );
    }
    const isSupported = entry.status === 'supported';
    const isProspective = entry.status === 'prospective';
    if (entry.bawaChainId !== undefined) {
      if (isSupported && !isNonEmptyString(entry.bawaChainId)) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'bawaChainId')}: a supported entry needs a non-empty bawaChainId`,
        );
      }
      if (isProspective && entry.bawaChainId !== null) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'bawaChainId')}: a prospective entry needs bawaChainId null, found '${entry.bawaChainId}'`,
        );
      }
      if (isNonEmptyString(entry.bawaChainId)) {
        if (seenBawaChainIds.has(entry.bawaChainId)) {
          errors.push(
            `generate-chains: registry/capabilities.json ${label(key, 'bawaChainId')}: '${entry.bawaChainId}' is already used by coins.${seenBawaChainIds.get(entry.bawaChainId)}`,
          );
        } else {
          seenBawaChainIds.set(entry.bawaChainId, key);
        }
      }
    }
    if (entry.coinTypeName !== undefined) {
      if (!isNonEmptyString(entry.coinTypeName)) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'coinTypeName')}: expected a non-empty string`,
        );
      } else if (
        isSupported &&
        !SUPPORTED_COIN_TYPE_NAMES.includes(entry.coinTypeName)
      ) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'coinTypeName')}: '${entry.coinTypeName}' is not a ChainConfig coinTypeName (${SUPPORTED_COIN_TYPE_NAMES.join(', ')})`,
        );
      }
    }
    if (entry.coinId !== undefined && !isNonNegativeInteger(entry.coinId)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'coinId')}: expected a non-negative integer`,
      );
    }
    if (entry.symbol !== undefined && !isNonEmptyString(entry.symbol)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'symbol')}: expected a non-empty string`,
      );
    }
    if (entry.decimals !== undefined && !isNonNegativeInteger(entry.decimals)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'decimals')}: expected a non-negative integer`,
      );
    }
    if (entry.curve !== undefined && !isNonEmptyString(entry.curve)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'curve')}: expected a non-empty string`,
      );
    }
    if (
      entry.derivationTemplate !== undefined &&
      !isNonEmptyString(entry.derivationTemplate)
    ) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'derivationTemplate')}: expected a non-empty string`,
      );
    }
    if (
      entry.evmChainId !== undefined &&
      entry.evmChainId !== null &&
      !isNonNegativeInteger(entry.evmChainId)
    ) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'evmChainId')}: expected null or a non-negative integer`,
      );
    }
    if (entry.displayName !== undefined && !isNonEmptyString(entry.displayName)) {
      errors.push(
        `generate-chains: registry/capabilities.json ${label(key, 'displayName')}: expected a non-empty string`,
      );
    }
    for (const field of ['networkId', 'assetId', 'profileId']) {
      if (entry[field] === undefined) continue;
      if (isSupported && !isNonEmptyString(entry[field])) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, field)}: a supported entry needs a non-empty string`,
        );
      }
      if (isProspective && entry[field] !== null) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, field)}: a prospective entry needs ${field} null`,
        );
      }
    }
    if (entry.rpcEndpoints !== undefined) {
      if (isSupported) {
        if (!Array.isArray(entry.rpcEndpoints)) {
          errors.push(
            `generate-chains: registry/capabilities.json ${label(key, 'rpcEndpoints')}: a supported entry needs an array of https: URLs`,
          );
        } else {
          for (const endpoint of entry.rpcEndpoints) {
            let https = false;
            if (typeof endpoint === 'string') {
              try {
                https = new URL(endpoint).protocol === 'https:';
              } catch {
                https = false;
              }
            }
            if (!https) {
              errors.push(
                `generate-chains: registry/capabilities.json ${label(key, 'rpcEndpoints')}: '${endpoint}' is not an https: URL`,
              );
            }
          }
        }
      }
      if (isProspective && entry.rpcEndpoints !== null) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, 'rpcEndpoints')}: a prospective entry needs rpcEndpoints null`,
        );
      }
    }
    // An emitted string literal cannot span lines; a newline in an
    // emitted field would corrupt the block, so it is a violation.
    for (const field of EMITTED_FIELDS) {
      const value = entry[field];
      if (typeof value === 'string' && /[\r\n]/.test(value)) {
        errors.push(
          `generate-chains: registry/capabilities.json ${label(key, field)}: must not contain a newline`,
        );
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && /[\r\n]/.test(item)) {
            errors.push(
              `generate-chains: registry/capabilities.json ${label(key, field)}: must not contain a newline`,
            );
          }
        }
      }
    }
    if (isSupported && isNonEmptyString(entry.bawaChainId)) {
      supported.push(entry);
    }
  }
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  if (supported.length === 0) {
    throw new Error(
      'generate-chains: registry/capabilities.json coins: no supported entry found',
    );
  }
  return supported;
}

// A single-quoted TypeScript string literal for a registry value.
function tsString(value) {
  return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function tsValue(field, value) {
  if (value === null) return 'null';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return tsString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length === 1) return '[' + tsString(value[0]) + ']';
    return (
      '[\n' + value.map((item) => '      ' + tsString(item) + ',').join('\n') + '\n    ]'
    );
  }
  throw new Error(`generate-chains: cannot emit ${field}: unsupported value ${JSON.stringify(value)}`);
}

// The full generated block, markers included, ending with a newline.
// Deterministic: same registry input emits byte-identical output (registry
// order, fixed field order, fixed formatting).
function generateBlock(supported) {
  // The key type is the supported-chain union from the registry (coins with
  // a non-null bawaChainId), not ChainId: the other listed chains have no
  // generated facts, so Record<ChainId, ...> would demand entries that do
  // not exist (TS2740 once ChainId grew past the four supported chains).
  const chainUnion = supported
    .map((entry) => `'${entry.bawaChainId}'`)
    .join(' | ');
  const lines = [
    BEGIN_MARKER,
    '// Drift check: from apps/web run `node scripts/generate-chains.mjs --check`;',
    '// it exits 1 when this block differs from registry/capabilities.json.',
    '// Capabilities, evidence, enablement and derivation behaviour stay',
    '// hand-written in chains.ts — only the eight static facts per chain below',
    '// are generated. The registry mixes upstream Wallet Core registry.json',
    '// values with Bawa-added fields (profileId, rpcEndpoints, xpubVersion',
    '// from SLIP-0132 version bytes — the upstream registry carries xpub',
    '// labels only).',
    'export const GENERATED_CHAIN_FACTS: Record<',
    `  ${chainUnion},`,
    '  Pick<',
    '    ChainConfig,',
    "    | 'displayName'",
    "    | 'symbol'",
    "    | 'coinTypeName'",
    "    | 'networkId'",
    "    | 'assetId'",
    "    | 'profileId'",
    "    | 'rpcEndpoints'",
    "    | 'evmChainId'",
    '  >',
    '> = {',
  ];
  for (const entry of supported) {
    lines.push(`  ${entry.bawaChainId}: {`);
    for (const field of EMITTED_FIELDS) {
      lines.push(`    ${field}: ${tsValue(field, entry[field])},`);
    }
    lines.push('  },');
  }
  lines.push('};');
  lines.push(END_MARKER);
  return lines.join('\n') + '\n';
}

// Locate the generated block in chains.ts text. Returns the exact slice
// from the BEGIN marker line through the END marker line (trailing
// newline included). Fails loudly naming the missing marker(s) instead
// of inventing a placement.
function findBlock(chainsText) {
  const beginCount = chainsText.split(BEGIN_MARKER).length - 1;
  const endCount = chainsText.split(END_MARKER).length - 1;
  if (beginCount === 0 || endCount === 0) {
    const missing = [];
    if (beginCount === 0) missing.push(BEGIN_MARKER);
    if (endCount === 0) missing.push(END_MARKER);
    throw new Error(
      `generate-chains: ${relative(REPO_DIR, CHAINS_PATH)} is missing the generated-block marker(s):\n` +
        missing.map((marker) => `  ${marker}`).join('\n') +
        '\nRefusing to invent a placement; the block is inserted by a separate step.',
    );
  }
  if (beginCount > 1 || endCount > 1) {
    throw new Error(
      `generate-chains: ${relative(REPO_DIR, CHAINS_PATH)} has duplicate generated-block markers ` +
        `(BEGIN x${beginCount}, END x${endCount}); exactly one pair is expected.`,
    );
  }
  const beginIndex = chainsText.indexOf(BEGIN_MARKER);
  const endIndex = chainsText.indexOf(END_MARKER);
  if (endIndex < beginIndex) {
    throw new Error(
      `generate-chains: ${relative(REPO_DIR, CHAINS_PATH)} has the END marker before the BEGIN marker.`,
    );
  }
  let end = endIndex + END_MARKER.length;
  if (chainsText[end] === '\n') end += 1;
  return { start: beginIndex, end, current: chainsText.slice(beginIndex, end) };
}

function replaceBlock(chainsText, block) {
  const found = findBlock(chainsText);
  return (
    chainsText.slice(0, found.start) + block + chainsText.slice(found.end)
  );
}

function loadRegistry() {
  let text;
  try {
    text = readFileSync(REGISTRY_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `generate-chains: cannot read registry/capabilities.json at ${REGISTRY_PATH}: ${error.message}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `generate-chains: registry/capabilities.json is not valid JSON: ${error.message}`,
    );
  }
}

function loadChains() {
  try {
    return readFileSync(CHAINS_PATH, 'utf8');
  } catch (error) {
    throw new Error(
      `generate-chains: cannot read ${relative(REPO_DIR, CHAINS_PATH)} at ${CHAINS_PATH}: ${error.message}`,
    );
  }
}

function usage() {
  return (
    'usage: node scripts/generate-chains.mjs [--check]\n' +
    '  (no flag)  rewrite the generated block in src/wallet/chains.ts\n' +
    '  --check    exit 1 when the block differs from registry/capabilities.json\n' +
    'Run from apps/web.'
  );
}

function main(argv) {
  let check = false;
  for (const arg of argv) {
    if (arg === '--check') {
      check = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(usage());
      return 0;
    } else {
      console.error(`generate-chains: unrecognised argument '${arg}'\n${usage()}`);
      return 1;
    }
  }
  const registry = loadRegistry();
  const supported = validateCoins(registry);
  const block = generateBlock(supported);
  const chainsText = loadChains();
  const found = findBlock(chainsText);
  const chainsRel = relative(REPO_DIR, CHAINS_PATH);
  if (found.current === block) {
    if (check) {
      console.log(
        'generate-chains: OK — src/wallet/chains.ts matches registry/capabilities.json',
      );
    } else {
      console.log(`generate-chains: ${chainsRel} is already up to date`);
    }
    return 0;
  }
  if (check) {
    console.error(
      `generate-chains: drift: ${chainsRel} differs from registry/capabilities.json — ` +
        `regenerate with: ${REGENERATE_COMMAND} (from apps/web)`,
    );
    return 1;
  }
  writeFileSync(CHAINS_PATH, replaceBlock(chainsText, block), 'utf8');
  console.log(`generate-chains: updated ${chainsRel}`);
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
