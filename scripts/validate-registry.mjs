import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { readFileSync } from "node:fs";

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

export function validateAll(
  registryDir = "registry",
  schemaDir = "registry/schemas",
) {
  const files = {};
  const paths = [
    ["profileSchema", join(schemaDir, "profile.schema.json")],
    ["registrySchema", join(schemaDir, "registry.schema.json")],
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

  const errors = validateStructure(files).concat(validateReferences(files));
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
