// scripts/plan-build.mjs — PR2 planner: prove a wallet-build request matches
// what the builder can build, BEFORE any generation.
//
// Pure functions; the only I/O is reading the registry (profiles.json,
// capabilities.json) from a directory passed in. No network, no generation,
// no writes, no secrets.
//
// The bug this gates (docs/wallet-reference-map.md:156): classifyRequest()
// routes "Build a web wallet for Solana" to the web-wallet profile even
// though that starter has no Solana support. The planner rejects it here
// with CHAIN_NOT_SUPPORTED.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA_VERSION = 1;
export const PLATFORMS = ['cli', 'web', 'android'];
export const MODES = ['offline', 'opt-in-read-only'];

// The 10 operations of wallet-build.schema.json `require`.
export const OPERATIONS = [
  'create',
  'derive',
  'restore',
  'receive',
  'balance',
  'history',
  'fee-quote',
  'plan-transfer',
  'local-sign',
  'verify-signature',
];

// Chains any profile in the registry supports (registry/profiles.json;
// also scripts/validate-registry.mjs CHAINS).
export const CHAINS = ['btc', 'eth', 'trx', 'ton'];

// Recognised real chains that no profile in the registry supports.
// Solana is the documented misroute: docs/wallet-reference-map.md names it
// "unsupported, named only" (no code path). A request naming one of these
// is CHAIN_NOT_SUPPORTED, not UNKNOWN_CHAIN: the chain is real and known,
// the builder simply cannot build for it. Any other id is UNKNOWN_CHAIN.
export const RECOGNISED_UNSUPPORTED_CHAINS = ['solana'];

// Statuses that count as "supported" in the registry.
export const SUPPORTED_STATUSES = [
  'IMPLEMENTED_AND_VERIFIED',
  'STARTER_IMPLEMENTED_AND_VERIFIED',
];

// Operations that need network access (schema allOf: offline forbids them).
export const OFFLINE_FORBIDDEN_OPERATIONS = ['balance', 'history', 'fee-quote'];

// Map from the schema's operation vocabulary to the registry's capability
// vocabulary (registry/capabilities.json entries[].capabilities keys, which
// predate the schema: generate / derive / watch-only / receive-address /
// import / recover / send / sign / broadcast / confirm).
//
// - create -> generate: creating a wallet IS generating a fresh wallet
//   (24-word BIP-39 + keys).
// - derive -> derive: same primitive.
// - restore -> recover: restoring from a mnemonic is recovery.
// - receive -> derive: a receive address is the derived receiving address
//   at the fixed path (the registry evidence for `derive` is literally
//   watch-only derivation at that path). The registry's `receive-address`
//   entry is DOCUMENTED_NOT_TESTED everywhere: it covers the old, unbuilt
//   receive flow, not the verified derivation primitive that produces
//   receive addresses in the rebuilt wallet.
// - plan-transfer -> send: planning a transfer is unsigned-send
//   construction.
// - local-sign -> sign; verify-signature -> sign: the registry's `sign`
//   capability covers signing plus its independent-verification evidence
//   (tools/mainnet-signing/local-signing.mjs).
// - balance / history / fee-quote have NO registry capability key: no
//   entry in capabilities.json covers live balances, history or fee
//   quotes, so they fail closed (OPERATION_NOT_SUPPORTED) until the
//   registry lane records per-operation status for them.
export const OPERATION_CAPABILITY_KEY = {
  create: 'generate',
  derive: 'derive',
  restore: 'recover',
  receive: 'derive',
  'plan-transfer': 'send',
  'local-sign': 'sign',
  'verify-signature': 'sign',
};

const ID_PATTERN = /^[a-z0-9][a-zA-Z0-9._:-]{1,79}$/;
const PROFILE_PATTERN = /^[a-z][a-z0-9-]{1,79}$/;

const DEFAULT_REGISTRY_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'registry',
);

export function loadRegistry(registryDir = DEFAULT_REGISTRY_DIR) {
  const profilesPath = join(registryDir, 'profiles.json');
  const capabilitiesPath = join(registryDir, 'capabilities.json');
  let profiles;
  let capabilities;
  try {
    profiles = JSON.parse(readFileSync(profilesPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read registry profiles at ${profilesPath}: ${error.message}`,
    );
  }
  try {
    capabilities = JSON.parse(readFileSync(capabilitiesPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `cannot read registry capabilities at ${capabilitiesPath}: ${error.message}`,
    );
  }
  const profileList = Array.isArray(profiles) ? profiles : profiles.profiles;
  const capabilityEntries = Array.isArray(capabilities)
    ? capabilities
    : capabilities.entries;
  if (!Array.isArray(profileList)) {
    throw new Error(
      `registry profiles at ${profilesPath} is not an array (nor { profiles: [...] })`,
    );
  }
  if (!Array.isArray(capabilityEntries)) {
    throw new Error(
      `registry capabilities at ${capabilitiesPath} has no entries array`,
    );
  }
  return { profiles: profileList, capabilityEntries, dir: registryDir };
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function err(code, message) {
  return { code, message };
}

function supportedStatusList() {
  return SUPPORTED_STATUSES.join(', ');
}

// --- Schema validation (hand-rolled, per wallet-build.schema.json) ---

function validateSchema(request) {
  const errors = [];
  if (!isObject(request)) {
    return [
      err(
        'INVALID_SCHEMA',
        `request must be an object, got ${Array.isArray(request) ? 'array' : typeof request}`,
      ),
    ];
  }
  const allowedKeys = [
    'schemaVersion',
    'targets',
    'mode',
    'networks',
    'require',
    'broadcast',
  ];
  for (const key of Object.keys(request)) {
    if (!allowedKeys.includes(key)) {
      errors.push(
        err(
          'INVALID_SCHEMA',
          `unknown property '${key}' (allowed: ${allowedKeys.join(', ')})`,
        ),
      );
    }
  }
  for (const key of allowedKeys) {
    if (!(key in request)) {
      errors.push(
        err('INVALID_SCHEMA', `missing required property '${key}'`),
      );
    }
  }
  if ('schemaVersion' in request && request.schemaVersion !== SCHEMA_VERSION) {
    errors.push(
      err(
        'INVALID_SCHEMA',
        `schemaVersion must be ${SCHEMA_VERSION}, got ${JSON.stringify(request.schemaVersion)}`,
      ),
    );
  }
  if ('targets' in request) {
    const targets = request.targets;
    if (!Array.isArray(targets) || targets.length === 0) {
      errors.push(
        err(
          'INVALID_SCHEMA',
          `targets must be a non-empty array of platforms (${PLATFORMS.join(', ')}), got ${JSON.stringify(targets)}`,
        ),
      );
    } else {
      for (const target of targets) {
        if (!PLATFORMS.includes(target)) {
          errors.push(
            err(
              'INVALID_SCHEMA',
              `unknown target '${target}' (known platforms: ${PLATFORMS.join(', ')})`,
            ),
          );
        }
      }
      if (new Set(targets).size !== targets.length) {
        errors.push(
          err(
            'INVALID_SCHEMA',
            `targets must not contain duplicates, got ${JSON.stringify(targets)}`,
          ),
        );
      }
    }
  }
  if ('mode' in request && !MODES.includes(request.mode)) {
    errors.push(
      err(
        'INVALID_SCHEMA',
        `mode must be one of ${MODES.join(', ')}, got ${JSON.stringify(request.mode)}`,
      ),
    );
  }
  if ('networks' in request) {
    const networks = request.networks;
    if (!Array.isArray(networks) || networks.length === 0) {
      errors.push(
        err(
          'INVALID_SCHEMA',
          `networks must be a non-empty array of { id, profile } objects, got ${JSON.stringify(networks)}`,
        ),
      );
    } else {
      const seen = new Set();
      networks.forEach((network, index) => {
        const label = `networks[${index}]`;
        if (!isObject(network)) {
          errors.push(
            err(
              'INVALID_SCHEMA',
              `${label} must be an object { id, profile }, got ${JSON.stringify(network)}`,
            ),
          );
          return;
        }
        for (const key of Object.keys(network)) {
          if (key !== 'id' && key !== 'profile') {
            errors.push(
              err(
                'INVALID_SCHEMA',
                `${label} has unknown property '${key}' (allowed: id, profile)`,
              ),
            );
          }
        }
        if (typeof network.id !== 'string' || !ID_PATTERN.test(network.id)) {
          errors.push(
            err(
              'INVALID_SCHEMA',
              `${label}.id must match ${ID_PATTERN}, got ${JSON.stringify(network.id)}`,
            ),
          );
        }
        if (
          typeof network.profile !== 'string' ||
          !PROFILE_PATTERN.test(network.profile)
        ) {
          errors.push(
            err(
              'INVALID_SCHEMA',
              `${label}.profile must match ${PROFILE_PATTERN}, got ${JSON.stringify(network.profile)}`,
            ),
          );
        }
        const key = JSON.stringify([network.id, network.profile]);
        if (seen.has(key)) {
          errors.push(
            err(
              'INVALID_SCHEMA',
              `${label} duplicates an earlier network ${JSON.stringify(network)}`,
            ),
          );
        }
        seen.add(key);
      });
    }
  }
  if ('require' in request) {
    const requireOps = request.require;
    if (!Array.isArray(requireOps) || requireOps.length === 0) {
      errors.push(
        err(
          'INVALID_SCHEMA',
          `require must be a non-empty array of operations (${OPERATIONS.join(', ')}), got ${JSON.stringify(requireOps)}`,
        ),
      );
    } else {
      for (const op of requireOps) {
        if (!OPERATIONS.includes(op)) {
          errors.push(
            err(
              'INVALID_SCHEMA',
              `unknown operation '${op}' in require (known operations: ${OPERATIONS.join(', ')})`,
            ),
          );
        }
      }
      if (new Set(requireOps).size !== requireOps.length) {
        errors.push(
          err(
            'INVALID_SCHEMA',
            `require must not contain duplicates, got ${JSON.stringify(requireOps)}`,
          ),
        );
      }
    }
  }
  return errors;
}

// --- Operation support ---

// Status of one operation in a profile's own `operations` object, if the
// profile has one. Accepts a bare status string or { status }.
function profileOperationsStatus(profile, operation) {
  const operations = profile?.operations;
  if (!isObject(operations)) return { found: false, status: null };
  if (!(operation in operations)) return { found: false, status: null };
  const value = operations[operation];
  if (typeof value === 'string') return { found: true, status: value };
  if (isObject(value) && typeof value.status === 'string') {
    return { found: true, status: value.status };
  }
  return { found: true, status: null };
}

// The chain's mainnet entry in capabilities.json (chains are uppercase
// there: BTC/ETH/TRX/TON; networks include 'mainnet' or id ends -mainnet).
function mainnetEntryFor(capabilityEntries, chain) {
  const upper = chain.toUpperCase();
  return (
    capabilityEntries.find((entry) => {
      const chains = Array.isArray(entry?.chains) ? entry.chains : [];
      const networks = Array.isArray(entry?.networks) ? entry.networks : [];
      const chainsMatch = chains.some(
        (c) => String(c).toUpperCase() === upper,
      );
      const isMainnet =
        networks.some((n) => String(n).toLowerCase() === 'mainnet') ||
        String(entry?.id ?? '')
          .toLowerCase()
          .endsWith('-mainnet');
      return chainsMatch && isMainnet;
    }) ?? null
  );
}

// --- Planner ---

export function planFromRequest(request, registryDir = DEFAULT_REGISTRY_DIR) {
  const { profiles, capabilityEntries } = loadRegistry(registryDir);
  const errors = [];

  // 1. Schema shape. Deeper checks cannot run on a malformed request.
  const schemaErrors = validateSchema(request);
  if (schemaErrors.length > 0) return { ok: false, errors: schemaErrors };

  const profileById = new Map(profiles.map((p) => [p?.id, p]));
  const knownProfileIds = profiles.map((p) => p?.id).filter(Boolean);

  // 2. Broadcast must be exactly "disabled".
  if (request.broadcast !== 'disabled') {
    errors.push(
      err(
        'BROADCAST_NOT_DISABLED',
        `broadcast must be "disabled", got ${JSON.stringify(request.broadcast)}; the planner never authorises broadcasting real transactions`,
      ),
    );
  }

  // 3-5. Per-network chain / profile / chain-in-profile checks.
  // Networks that pass all three are usable for the operation check.
  const usable = [];
  for (const network of request.networks) {
    const { id: chain, profile: profileId } = network;
    const profile = profileById.get(profileId);
    if (!CHAINS.includes(chain)) {
      if (RECOGNISED_UNSUPPORTED_CHAINS.includes(chain)) {
        errors.push(
          err(
            'CHAIN_NOT_SUPPORTED',
            `chain '${chain}' is not supported by profile '${profileId}' (supported chains: ${CHAINS.join(', ')}); no profile in the registry supports ${chain}`,
          ),
        );
      } else {
        errors.push(
          err(
            'UNKNOWN_CHAIN',
            `unknown chain '${chain}' for profile '${profileId}' (known chains: ${CHAINS.join(', ')}); no profile in the registry supports '${chain}'`,
          ),
        );
      }
      continue;
    }
    if (!profile) {
      errors.push(
        err(
          'UNKNOWN_PROFILE',
          `profile '${profileId}' does not exist in the registry (known profiles: ${knownProfileIds.join(', ')}); network '${chain}' cannot be planned`,
        ),
      );
      continue;
    }
    const profileChains = Array.isArray(profile.chains) ? profile.chains : [];
    if (!profileChains.includes(chain)) {
      const supporters = profiles
        .filter((p) => Array.isArray(p?.chains) && p.chains.includes(chain))
        .map((p) => p.id);
      const supporterText =
        supporters.length > 0
          ? `supported by: ${supporters.join(', ')}`
          : `no profile in the registry supports ${chain}`;
      errors.push(
        err(
          'CHAIN_NOT_SUPPORTED',
          `chain '${chain}' is not supported by profile '${profileId}' (supported chains: ${profileChains.join(', ') || 'none'}); ${supporterText}`,
        ),
      );
      continue;
    }
    usable.push({ chain, profileId, profile });
  }

  // 6. Operation support, per usable network. Fail closed.
  for (const { chain, profileId, profile } of usable) {
    for (const operation of request.require) {
      if (isObject(profile?.operations)) {
        const fromProfile = profileOperationsStatus(profile, operation);
        if (
          !fromProfile.found ||
          !SUPPORTED_STATUSES.includes(fromProfile.status)
        ) {
          errors.push(
            err(
              'OPERATION_NOT_SUPPORTED',
              `operation '${operation}' is not supported for chain '${chain}' on profile '${profileId}' (profile operations status: ${fromProfile.found ? JSON.stringify(fromProfile.status) : 'not listed'}; supported statuses: ${supportedStatusList()})`,
            ),
          );
        }
        continue;
      }
      const key = OPERATION_CAPABILITY_KEY[operation];
      if (key === undefined) {
        errors.push(
          err(
            'OPERATION_NOT_SUPPORTED',
            `operation '${operation}' is not supported for chain '${chain}' on profile '${profileId}' (no registry capability covers '${operation}'; the registry records no verified status for live balances, history or fee quotes)`,
          ),
        );
        continue;
      }
      const entry = mainnetEntryFor(capabilityEntries, chain);
      if (!entry) {
        errors.push(
          err(
            'OPERATION_NOT_SUPPORTED',
            `operation '${operation}' is not supported for chain '${chain}' on profile '${profileId}' (no mainnet capability entry for '${chain}' in the registry)`,
          ),
        );
        continue;
      }
      const capabilities = isObject(entry.capabilities)
        ? entry.capabilities
        : {};
      const status = capabilities[key];
      if (!SUPPORTED_STATUSES.includes(status)) {
        errors.push(
          err(
            'OPERATION_NOT_SUPPORTED',
            `operation '${operation}' is not supported for chain '${chain}' on profile '${profileId}' (registry capability '${key}' for '${chain}-mainnet' is ${JSON.stringify(status ?? null)}; supported statuses: ${supportedStatusList()})`,
          ),
        );
      }
    }
  }

  // 7. Mode / operation conflicts.
  if (request.mode === 'offline') {
    for (const op of request.require) {
      if (OFFLINE_FORBIDDEN_OPERATIONS.includes(op)) {
        errors.push(
          err(
            'MODE_OPERATION_CONFLICT',
            `mode 'offline' cannot require operation '${op}' ('${op}' needs network access; use mode 'opt-in-read-only' or drop '${op}')`,
          ),
        );
      }
    }
  }
  if (request.require.includes('local-sign')) {
    const missing = ['plan-transfer', 'verify-signature'].filter(
      (op) => !request.require.includes(op),
    );
    if (missing.length > 0) {
      errors.push(
        err(
          'MODE_OPERATION_CONFLICT',
          `operation 'local-sign' requires 'plan-transfer' and 'verify-signature' in the same request (missing: ${missing.join(', ')})`,
        ),
      );
    }
  }

  // Dedupe identical messages, preserving order.
  const deduped = [
    ...new Map(errors.map((e) => [`${e.code}:${e.message}`, e])).values(),
  ];

  if (deduped.length > 0) return { ok: false, errors: deduped };

  const distinctProfiles = [...new Set(request.networks.map((n) => n.profile))];
  const distinctEngines = [
    ...new Map(
      usable.map(({ profile }) => {
        const engine = isObject(profile.engine) ? profile.engine : {};
        return [
          `${engine.name ?? ''}@${engine.version ?? ''}`,
          { name: engine.name, version: engine.version },
        ];
      }),
    ).values(),
  ];
  return {
    ok: true,
    plan: {
      targets: [...request.targets],
      profile:
        distinctProfiles.length === 1 ? distinctProfiles[0] : distinctProfiles,
      chains: request.networks.map((n) => n.id),
      operations: [...request.require],
      mode: request.mode,
      engine:
        distinctEngines.length === 1 ? distinctEngines[0] : distinctEngines,
    },
  };
}

// Entry point the builder (Lane C) uses for plain-language requests: the
// profile id comes from classifyRequest(), the chains are the ones named in
// the request, and the operations are the ones implied. Builds the
// wallet-build.json-shaped request and plans it.
export function planFromNaturalLanguage(
  profileId,
  chains,
  operations,
  mode,
  broadcast,
  registryDir = DEFAULT_REGISTRY_DIR,
) {
  const chainList = (Array.isArray(chains) ? chains : [chains])
    .filter((c) => c !== undefined && c !== null)
    .map((c) => String(c).trim().toLowerCase());
  const operationList = (Array.isArray(operations) ? operations : [operations])
    .filter((o) => o !== undefined && o !== null)
    .map((o) => String(o).trim().toLowerCase());

  // Targets come from the classified profile's platform. When the profile
  // id is unknown there is no platform to derive; use a schema-valid
  // placeholder — planFromRequest fails the request with UNKNOWN_PROFILE
  // before any plan is produced, so the placeholder never reaches a plan.
  let targets = ['cli'];
  try {
    const { profiles } = loadRegistry(registryDir);
    const profile = profiles.find((p) => p?.id === profileId);
    if (profile && typeof profile.platform === 'string') {
      targets = [profile.platform];
    }
  } catch {
    // Registry unreadable: planFromRequest raises the same error.
  }

  return planFromRequest(
    {
      schemaVersion: SCHEMA_VERSION,
      targets,
      mode: mode ?? 'opt-in-read-only',
      networks: chainList.map((id) => ({ id, profile: profileId })),
      require: operationList,
      broadcast: broadcast ?? 'disabled',
    },
    registryDir,
  );
}
