// Regenerates src/wallet/clear-signing-snapshot.json from a checkout of
// the ERC-7730 clear-signing registry.
//
// Usage:
//   node scripts/generate-clear-signing-snapshot.mjs <registry-dir>
//
// The registry checkout is the surveyed one (an okxlabs fork,
// okxlabs/clear-signing-erc7730-registry, commit 3d60345, which merges
// ethereum:master). The canonical upstream is the Ethereum Foundation
// registry at https://github.com/ethereum/clear-signing-erc7730-registry
// — a future refresh should pull from upstream and re-run this script.
//
// Only a curated subset is vendored: the full registry is 6.1 MB
// (814 calldata entries; the index alone is 88 KB) and the web bundle
// has ~4.8 KB of headroom, so the whole registry cannot ship. The
// subset is the generic ERC-20 descriptors (the only contract calls
// this wallet builds itself) plus one widely-deployed contract whose
// descriptors prove the per-contract path. The script verifies every
// signature, intent and deployment it copies against the source files
// and fails loudly on any mismatch instead of emitting stale data.
//
// The snapshot uses compact keys (the payload ships in the web
// bundle, so every byte counts); the schema is:
//   { g: generic functions, c: contracts }
//   function: { s: signature, i: intent, p: params }
//   param:    { t: display type, l: label, m?: is the token amount }
//   contract: { n: name, a: address, c: chain ids, f: functions }
// Display types are address/uint only: the decoder in
// clear-signing.ts decodes exactly those, and anything else resolves
// to no match. 1inch packs addresses as uint256 (the registry slices
// their low 20 bytes); those params are recorded with display type
// address, which renders the same low 20 bytes.
//
// What is NOT carried over, deliberately: the registry's $ref field
// formatters (tokenAmount with token metadata, addressName/ENS lookup,
// date/enum rendering) and EIP-712 descriptors — the wallet has no
// EIP-712 signing surface, and values are rendered generically by ABI
// type in clear-signing.ts. Labels and intents below come from the
// registry; parameter names come from the function signatures.
// Licence of the registry data: CC0 1.0 (recorded here and in
// clear-signing.ts, not in the payload — the payload is size-critical).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const registryDir = process.argv[2];
if (!registryDir) {
  console.error(
    'Usage: node scripts/generate-clear-signing-snapshot.mjs <registry-dir>',
  );
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(registryDir, relativePath), 'utf8'));
}

function fail(message) {
  console.error(`generate-clear-signing-snapshot: ${message}`);
  process.exit(1);
}

// Display types are canonicalised: address stays address, any uintN
// becomes uint (the decoder renders every unsigned integer as a
// decimal string, so the width carries no display meaning).
function canonicalDisplayType(type) {
  if (type === 'address') return 'address';
  if (/^uint[0-9]*$/.test(type)) return 'uint';
  return type;
}
// The emitted params carry no `name`: decoding is positional (param
// order follows the signature), and only label/type/flags are shown.
// Keeping names would cost bundle bytes for no runtime use.
function emitParam(param) {
  const emitted = { t: param.displayType, l: param.label };
  if (param.amount === true) emitted.m = true;
  return emitted;
}

// --- Generic ERC-20 descriptors (ercs/calldata-erc20-tokens.json) --------
// These apply to any ERC-20 token contract (the descriptor's own
// context.contract is empty), so they are keyed by function signature
// only. The wallet builds transfer() calls itself; approve() is covered
// because a future approval flow would show the same call.
const erc20 = readJson('ercs/calldata-erc20-tokens.json');
const erc20Formats = erc20?.display?.formats;
if (!erc20Formats) fail('ercs/calldata-erc20-tokens.json has no display.formats');

function erc20Function(signature, intent, params) {
  const format = erc20Formats[signature];
  if (!format) fail(`ERC-20 descriptor is missing ${signature}`);
  if (format.intent !== intent) {
    fail(`ERC-20 ${signature} intent changed: ${format.intent}`);
  }
  const labels = {};
  for (const field of format.fields ?? []) {
    labels[field.path] = field.label;
  }
  for (const param of params) {
    if (labels[param.name] !== param.label) {
      fail(`ERC-20 ${signature} label changed for ${param.name}`);
    }
    if (param.displayType !== canonicalDisplayType(param.type)) {
      fail(`ERC-20 ${signature}: display type differs for ${param.name}`);
    }
  }
  return { s: signature, i: intent, p: params.map(emitParam) };
}

const generic = [
  erc20Function('transfer(address _to, uint256 _value)', 'Send', [
    { name: '_to', type: 'address', displayType: 'address', label: 'To' },
    { name: '_value', type: 'uint256', displayType: 'uint', label: 'Amount', amount: true },
  ]),
  erc20Function('approve(address _spender, uint256 _value)', 'Approve', [
    { name: '_spender', type: 'address', displayType: 'address', label: 'Spender' },
    { name: '_value', type: 'uint256', displayType: 'uint', label: 'Amount', amount: true },
  ]),
];

// --- Per-contract descriptors --------------------------------------------
// Deployments come from each descriptor's context.contract.deployments;
// functions come from the shared `common-*` file the descriptor
// includes, with labels resolved through display.definitions ($refs).

function deployments(descriptorPath) {
  const descriptor = readJson(descriptorPath);
  const list = descriptor?.context?.contract?.deployments;
  if (!Array.isArray(list) || list.length === 0) {
    fail(`${descriptorPath} has no contract deployments`);
  }
  const address = list[0].address.toLowerCase();
  const chains = [];
  for (const entry of list) {
    if (entry.address.toLowerCase() !== address) {
      fail(`${descriptorPath} deploys different addresses per chain`);
    }
    chains.push(entry.chainId);
  }
  return { address, chains };
}

function registryFunction(formats, definitions, signature, intent, params) {
  const format = formats[signature];
  if (!format) fail(`descriptor is missing ${signature}`);
  if (format.intent !== intent) {
    fail(`${signature} intent changed: ${format.intent}`);
  }
  // Resolve each param's label: a field with an explicit label wins,
  // otherwise a $ref into display.definitions supplies the label.
  const resolved = {};
  for (const field of format.fields ?? []) {
    const ref = field.$ref ?? '';
    const definitionName = ref.replace(/^\$\.display\.definitions\./, '');
    const fromDefinition = definitions?.[definitionName]?.label;
    const label = field.label ?? fromDefinition;
    if (label) resolved[field.path] = label;
  }
  for (const param of params) {
    const candidates = [
      param.name,
      `${param.name}.[-20:]`,
      `${param.name}.[-4:]`,
    ];
    const found = candidates.find((path) => resolved[path] !== undefined);
    if (found === undefined && param.label !== param.name) {
      fail(`${signature}: no registry label for ${param.name}`);
    }
    if (found !== undefined && resolved[found] !== param.label) {
      fail(`${signature}: label changed for ${param.name}: ${resolved[found]}`);
    }
    // A display type of address for a uint256 registry type is the
    // documented 1inch packing (low 20 bytes are the address).
    const canonical = canonicalDisplayType(param.type);
    if (
      param.displayType !== canonical &&
      !(param.type === 'uint256' && param.displayType === 'address')
    ) {
      fail(`${signature}: unexpected display type for ${param.name}`);
    }
  }
  return { s: signature, i: intent, p: params.map(emitParam) };
}

// 1inch AggregationRouterV6 — the registry's own test vectors
// (testsv2/calldata-AggregationRouterV6.tests.json, unoswapTo) prove
// the decoding. Its uint256 params pack addresses (to, token, dex);
// the registry slices their low 20 bytes, so the snapshot records
// display type address for them. Only unoswapTo is vendored (the
// registry's proven vector): swap() takes a tuple, which the decoder
// does not support, and every further function costs bundle bytes.
// Safe 1.4.1 execTransaction is NOT vendored: it needs dynamic bytes
// decoding and the bundle has no room for it — the generator can grow
// a second contract entry when the decoder grows with it.
const oneInchCommon = readJson('registry/1inch/common-AggregationRouterV6.json');
const oneInchFormats = oneInchCommon?.display?.formats;
const oneInchDefinitions = oneInchCommon?.display?.definitions;
if (!oneInchFormats) fail('1inch common file has no display.formats');
const oneInch = deployments('registry/1inch/calldata-AggregationRouterV6.json');

const contracts = [
  {
    n: '1inch AggregationRouterV6',
    a: oneInch.address,
    c: oneInch.chains,
    f: [
      registryFunction(
        oneInchFormats,
        oneInchDefinitions,
        'unoswapTo(uint256 to, uint256 token, uint256 amount, uint256 minReturn, uint256 dex)',
        'Swap',
        [
          { name: 'to', type: 'uint256', displayType: 'address', label: 'Beneficiary' },
          { name: 'token', type: 'uint256', displayType: 'address', label: 'token' },
          { name: 'amount', type: 'uint256', displayType: 'uint', label: 'Amount to Send' },
          { name: 'minReturn', type: 'uint256', displayType: 'uint', label: 'Minimum to Receive' },
          { name: 'dex', type: 'uint256', displayType: 'address', label: 'Last pool' },
        ],
      ),
    ],
  },
];

const snapshot = { g: generic, c: contracts };

const outPath = new URL(
  '../src/wallet/clear-signing-snapshot.json',
  import.meta.url,
);
writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(
  `wrote ${outPath.pathname} (${generic.length} generic functions, ${contracts.length} contracts)`,
);
