import { pathToFileURL } from "node:url";
import { dirname, join, resolve, sep } from "node:path";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";

export function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`${path}: ${error.message}`);
  }
}

export function checkRequired(obj, required, label, errors) {
  for (const name of required) {
    if (obj == null || !Object.prototype.hasOwnProperty.call(obj, name)) {
      errors.push(`ERROR ${label}: missing required field '${name}'`);
    }
  }
}

export function checkEnum(value, allowed, label, errors) {
  if (!allowed.includes(value)) {
    errors.push(`ERROR ${label}: value '${value}' not in enum [${allowed.join(", ")}]`);
  }
}

export function validateStructure(files) {
  const { profileSchema, registrySchema, profiles, capabilities, engines, ui } = files;
  const errors = [];

  if (!Array.isArray(profiles)) {
    errors.push("ERROR profiles: expected an array");
  } else {
    if (profiles.length !== 7) {
      errors.push(`ERROR profiles: expected 7 profiles, found ${profiles.length}`);
    }

    const ids = new Set();
    for (const [index, profile] of profiles.entries()) {
      const label = `profiles[${profile?.id ?? index}]`;
      const id = profile?.id;

      checkRequired(profile, profileSchema.required, label, errors);
      checkEnum(id, profileSchema.properties.id.enum, `${label}.id`, errors);
      checkEnum(profile?.status, profileSchema.properties.status.enum, `${label}.status`, errors);
      // T44-F9: the hand-rolled validator enforced only id/status, but
      // the schema also constrains platform, chains and the
      // implemented/missing lists — and generate-project.mjs +
      // build-wallet.mjs trust all of them. Enforce them here.
      checkEnum(profile?.platform, ['cli', 'web', 'android'], `${label}.platform`, errors);
      if (!Array.isArray(profile?.chains) || profile.chains.length === 0) {
        errors.push(`ERROR ${label}.chains: expected a non-empty array`);
      }
      for (const field of ['implemented', 'missing']) {
        const value = profile?.[field];
        if (
          value !== undefined &&
          (!Array.isArray(value) || value.some((item) => typeof item !== 'string'))
        ) {
          errors.push(`ERROR ${label}.${field}: expected an array of strings`);
        }
      }

      if (id !== undefined) {
        if (ids.has(id)) {
          errors.push(`ERROR ${label}: duplicate id '${id}'`);
        }
        ids.add(id);
      }
    }
  }

  for (const [expected, registry] of Object.entries({ capabilities, engines, ui })) {
    checkRequired(registry, registrySchema.required, expected, errors);
    checkEnum(registry?.registry, [expected], `${expected}.registry`, errors);

    const entries = registry?.entries;
    if (!Array.isArray(entries) || entries.length === 0) {
      errors.push(`ERROR ${expected}.entries: expected a non-empty array`);
      continue;
    }

    const ids = new Set();
    for (const [index, entry] of entries.entries()) {
      const label = `${expected}.entries[${entry?.id ?? index}]`;
      const id = entry?.id;

      checkRequired(entry, ["id", "name", "status"], label, errors);
      checkEnum(entry?.status, registrySchema.definitions.status.enum, `${label}.status`, errors);

      if (id !== undefined) {
        if (ids.has(id)) {
          errors.push(`ERROR ${label}: duplicate id '${id}'`);
        }
        ids.add(id);
      }
    }
  }

  return errors;
}

export const CHAINS = ["btc", "eth", "trx", "ton"];
export const OPERATIONS = [
  "generate",
  "derive",
  "watch-only",
  "receive-address",
  "import",
  "recover",
  "send",
  "sign",
  "broadcast",
  "confirm",
];

export function validateReferences(files) {
  const errors = [];
  const asArray = (value) => (Array.isArray(value) ? value : []);
  const profiles = asArray(
    Array.isArray(files.profiles) ? files.profiles : files.profiles?.profiles,
  );
  const capabilities = asArray(files.capabilities?.entries);
  const engines = asArray(files.engines?.entries);
  const ui = asArray(files.ui?.entries);
  const statusEnum = files.registrySchema?.definitions?.status?.enum;

  if (!Array.isArray(statusEnum)) {
    errors.push(
      "ERROR registry.schema.json.definitions.status.enum: expected an array",
    );
  }

  const coreRevisions = new Set(
    engines
      .filter(
        (entry) =>
          typeof entry?.name === "string" &&
          entry.name.includes("Trust Wallet Core") &&
          entry.revision !== undefined,
      )
      .map((entry) => entry.revision),
  );
  const foundationIds = new Set(
    ui.filter((entry) => entry?.id !== undefined).map((entry) => entry.id),
  );

  profiles.forEach((profile, index) => {
    const label = `profiles.json.profiles[${profile?.id ?? index}]`;

    if (!Array.isArray(profile?.chains)) {
      errors.push(`ERROR ${label}.chains: expected an array`);
    } else {
      profile.chains.forEach((chain, chainIndex) => {
        checkEnum(chain, CHAINS, `${label}.chains[${chainIndex}]`, errors);
      });
    }

    if (!coreRevisions.has(profile?.engine?.version)) {
      errors.push(
        `ERROR ${label}.engine.version: must match the revision of a Trust Wallet Core entry in engines.json`,
      );
    }

    // T44-F9: the send/sign/broadcast hard rule also applies to a
    // profile's own implemented list — a profile claiming `send` as
    // implemented would make build-wallet.mjs report it as implemented.
    // Exact-element match: `missing` lists legitimately name them.
    if (Array.isArray(profile?.implemented)) {
      for (const operation of ['send', 'sign', 'broadcast']) {
        if (profile.implemented.includes(operation)) {
          errors.push(
            `ERROR ${label}.implemented: hard rule forbids claiming ${operation} as implemented`,
          );
        }
      }
    }

    const foundation = profile?.ui?.foundation;
    if (foundation !== "none" && !foundationIds.has(foundation)) {
      errors.push(
        `ERROR ${label}.ui.foundation: must be "none" or an id present in ui.json entries`,
      );
    }
  });

  capabilities.forEach((entry, index) => {
    const label = `capabilities.json.entries[${entry?.id ?? index}].capabilities`;
    const operationMap = entry?.capabilities;

    if (
      operationMap === null ||
      typeof operationMap !== "object" ||
      Array.isArray(operationMap)
    ) {
      errors.push(
        `ERROR ${label}: expected an object containing exactly the 10 operations`,
      );
      return;
    }

    checkRequired(operationMap, OPERATIONS, label, errors);

    for (const [operation, status] of Object.entries(operationMap)) {
      const operationLabel = `${label}.${operation}`;

      if (!OPERATIONS.includes(operation)) {
        errors.push(
          `ERROR ${operationLabel}: unexpected operation "${operation}"`,
        );
      }

      if (Array.isArray(statusEnum)) {
        checkEnum(status, statusEnum, operationLabel, errors);
      }

      if (
        ["send", "sign", "broadcast"].includes(operation) &&
        status === "IMPLEMENTED_AND_VERIFIED"
      ) {
        errors.push(
          `ERROR ${operationLabel}: hard rule forbids IMPLEMENTED_AND_VERIFIED for ${operation}`,
        );
      }
    }
  });

  return errors;
}

// T46: operation wording that must never appear in a profile's
// implemented[] list. The only signing code in the repository is a local, test-only signer restricted to temporary unfunded test credentials, and broadcast is not implemented, so any implemented claim using these words (including
// "sending", "signing", "broadcasting", "sent transactions",
// "signature creation" and transaction-submission wording) is false
// on its face. The words stay allowed in missing[], where they belong.
// Lexical checks cannot catch every euphemism; this covers the direct
// forms and the clearest near-synonyms.
export const FORBIDDEN_IMPLEMENTED =
  /\b(send(s|ing)?|sent|sign(s|ed|ing)?|signature(s)?|broadcast(s|ed|ing)?|submit(s|ted|ting)?|submission)\b/i;

export function validateProfileClaims(files) {
  const errors = [];
  const profiles = Array.isArray(files.profiles)
    ? files.profiles
    : (files.profiles?.profiles ?? []);

  profiles.forEach((profile, index) => {
    const label = `profiles.json.profiles[${profile?.id ?? index}]`;

    for (const field of ["implemented", "missing"]) {
      const value = profile?.[field];
      if (!Array.isArray(value)) {
        errors.push(`ERROR ${label}.${field}: expected an array of strings`);
        continue;
      }
      if (value.some((entry) => typeof entry !== "string")) {
        errors.push(`ERROR ${label}.${field}: expected an array of strings`);
      }
    }

    const implemented = Array.isArray(profile?.implemented)
      ? profile.implemented
      : [];
    const missing = Array.isArray(profile?.missing) ? profile.missing : [];

    for (const entry of implemented) {
      if (typeof entry === "string" && FORBIDDEN_IMPLEMENTED.test(entry)) {
        errors.push(
          `ERROR ${label}.implemented: entry ${JSON.stringify(entry)} claims a send/sign/broadcast capability; the only signing code in this repository is a local, test-only signer restricted to temporary unfunded test credentials, and broadcast is not implemented`,
        );
      }
    }

    const missingNormalized = new Set(
      missing
        .filter((entry) => typeof entry === "string")
        .map((entry) => entry.trim().toLowerCase()),
    );
    for (const entry of implemented) {
      if (
        typeof entry === "string" &&
        missingNormalized.has(entry.trim().toLowerCase())
      ) {
        errors.push(
          `ERROR ${label}: entry ${JSON.stringify(entry)} appears in both implemented[] and missing[]`,
        );
      }
    }
  });

  return errors;
}

// T46: the profile engine version must match the exact pin declared
// by the tool that implements it (tools/hdwallet-gen/package.json),
// not merely a revision listed in engines.json — agreement between
// two registry files cannot catch a coordinated wrong version.
export function validateEnginePin(files, repoRoot, strict) {
  const errors = [];
  const toolPkgPath = join(repoRoot, "tools", "hdwallet-gen", "package.json");
  let toolPkg = null;
  try {
    toolPkg = JSON.parse(readFileSync(toolPkgPath, "utf8"));
  } catch {
    if (strict) {
      errors.push(
        `ERROR tools/hdwallet-gen/package.json: cannot read the engine pin anchor at ${toolPkgPath}`,
      );
    }
    return errors;
  }

  const pin = toolPkg?.dependencies?.["@trustwallet/wallet-core"];
  if (typeof pin !== "string" || !/^\d+\.\d+\.\d+$/.test(pin)) {
    errors.push(
      "ERROR tools/hdwallet-gen/package.json: engine pin for @trustwallet/wallet-core must be an exact X.Y.Z version, not a range or a missing value",
    );
    return errors;
  }

  const profiles = Array.isArray(files.profiles)
    ? files.profiles
    : (files.profiles?.profiles ?? []);
  profiles.forEach((profile, index) => {
    const label = `profiles.json.profiles[${profile?.id ?? index}]`;
    if (profile?.engine?.name !== "trust-wallet-core") return;
    if (profile.engine.version !== pin) {
      errors.push(
        `ERROR ${label}.engine.version: '${profile.engine.version}' does not match the tools/hdwallet-gen pin '${pin}'`,
      );
    }
  });

  return errors;
}

// T46: the prompt file per profile. The routing doc's "create-<id>.md"
// shorthand does not hold for hd-wallet-cli, whose prompt is
// create-hd-wallet.md; the mapping is explicit here.
export const PROMPT_FILES = { "hd-wallet-cli": "create-hd-wallet.md" };

export function validateProfileAssets(files, repoRoot, strict) {
  const errors = [];
  const aiDir = join(repoRoot, "ai");
  if (!existsSync(aiDir)) {
    if (strict) {
      errors.push(`ERROR ai: directory missing at ${aiDir}`);
    }
    return errors;
  }

  const profiles = Array.isArray(files.profiles)
    ? files.profiles
    : (files.profiles?.profiles ?? []);
  const profileDir = join(aiDir, "profiles");
  const promptDir = join(aiDir, "prompts");

  // T46 re-audit: resolve symlinks before the containment check. A
  // lexical resolve() alone would accept an in-directory symlink
  // pointing at a file outside the repo; the canonical path must stay
  // inside the directory.
  const isContainedFile = (dir, filename) => {
    let realDir;
    try {
      realDir = realpathSync(dir);
    } catch {
      return false;
    }
    const target = resolve(dir, filename);
    if (!target.startsWith(dir + sep)) return false;
    try {
      const realTarget = realpathSync(target);
      return (
        realTarget.startsWith(realDir + sep) && statSync(realTarget).isFile()
      );
    } catch {
      return false;
    }
  };

  profiles.forEach((profile, index) => {
    const id = profile?.id;
    const label = `profiles.json.profiles[${id ?? index}]`;
    if (
      typeof id !== "string" ||
      id.includes("/") ||
      id.includes("\\") ||
      id.includes("..")
    ) {
      errors.push(`ERROR ${label}.id: '${String(id)}' is not a safe profile id`);
      return;
    }
    if (!isContainedFile(profileDir, `${id}.md`)) {
      errors.push(`ERROR ${label}: profile file missing: ai/profiles/${id}.md`);
    }
    const promptFile = PROMPT_FILES[id] ?? `create-${id}.md`;
    if (!isContainedFile(promptDir, promptFile)) {
      errors.push(`ERROR ${label}: prompt file missing: ai/prompts/${promptFile}`);
    }
  });

  return errors;
}

export function validateAll(registryDir = "registry", schemaDir, repoRoot) {
  // The schema directory defaults to <registryDir>/schemas, so a single
  // absolute registry directory works from any working directory. An
  // explicit schemaDir overrides it.
  const resolvedSchemaDir = schemaDir ?? join(registryDir, "schemas");
  const files = {};
  const paths = [
    ["profileSchema", join(resolvedSchemaDir, "profile.schema.json")],
    ["registrySchema", join(resolvedSchemaDir, "registry.schema.json")],
    ["profiles", join(registryDir, "profiles.json")],
    ["capabilities", join(registryDir, "capabilities.json")],
    ["engines", join(registryDir, "engines.json")],
    ["ui", join(registryDir, "ui.json")],
  ];

  for (const [key, filePath] of paths) {
    try {
      files[key] = loadJson(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        errors: [`ERROR ${filePath}: ${message}`],
        counts: { files: 4, entries: 0 },
      };
    }
  }

  // The repository root defaults to the registry directory's parent.
  // Callers that pass repoRoot explicitly (the generators) get strict
  // anchor enforcement: a missing tool manifest or ai/ directory is
  // an error, not a silent skip. A standalone registry copy validated
  // without an explicit root skips anchor checks whose files are
  // absent, and validates structure, references and claims only.
  const resolvedRepoRoot = repoRoot
    ? resolve(repoRoot)
    : dirname(resolve(registryDir));
  const strict = repoRoot !== undefined && repoRoot !== null;

  const errors = validateStructure(files)
    .concat(validateReferences(files))
    .concat(validateProfileClaims(files))
    .concat(validateEnginePin(files, resolvedRepoRoot, strict))
    .concat(validateProfileAssets(files, resolvedRepoRoot, strict));
  const entries = [
    Array.isArray(files.profiles) ? files.profiles : files.profiles?.profiles,
    files.capabilities?.entries,
    files.engines?.entries,
    files.ui?.entries,
  ].reduce(
    (total, collection) =>
      total + (Array.isArray(collection) ? collection.length : 0),
    0,
  );

  return { errors, counts: { files: 4, entries } };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let registryDir = "registry";
  let schemaDir = "registry/schemas";
  const args = process.argv.slice(2);
  const argumentErrors = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument !== "--registry-dir" && argument !== "--schema-dir") {
      argumentErrors.push(
        `ERROR arguments: unrecognised argument "${argument}"`,
      );
      continue;
    }

    const directory = args[index + 1];
    if (!directory || directory.startsWith("--")) {
      argumentErrors.push(
        `ERROR arguments: ${argument} requires a directory`,
      );
      continue;
    }

    index += 1;
    if (argument === "--registry-dir") {
      registryDir = directory;
    } else {
      schemaDir = directory;
    }
  }

  const result = argumentErrors.length
    ? { errors: argumentErrors, counts: { files: 4, entries: 0 } }
    : validateAll(resolve(registryDir), resolve(schemaDir));

  for (const error of result.errors) {
    console.error(error);
  }

  if (result.errors.length === 0) {
    console.log(
      `OK: ${result.counts.files} files, ${result.counts.entries} entries validated`,
    );
  }

  process.exitCode = result.errors.length === 0 ? 0 : 1;
}
