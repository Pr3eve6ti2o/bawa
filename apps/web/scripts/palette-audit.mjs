// apps/web/scripts/palette-audit.mjs
import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const distDir = resolve(repoRoot, 'apps/web/dist');

const extensions = new Set(['.css', '.svg', '.html']);
const allowed = new Set([
  '#FFFDF7', // Paper
  '#2B2B2B', // Ink
  '#FF6B4A', // Coral
  '#FFD93B', // Sun
  // Tailwind v4 framework internals: no visible colour in this app.
  '#0000', // Transparent: shadow/ring defaults and the preflight button reset.
  '#0000001A', // Default shadow colour in the unused `.shadow` utility rule.
  '#FFF', // Default `--tw-ring-offset-color`; no element uses a ring offset.
]);

// `rgb(from red r g b)` is a feature-detection placeholder inside a
// `@supports not (color: ...)` block, never a rendered colour.
const allowedFunctional = new Set(['rgb(from red r g b)']);

function decodePercentEscapes(source) {
  // Decode URI escapes, including %23, without choking on bare CSS percentages.
  return source.replace(/(?:%[0-9a-f]{2})+/gi, (encoded) => {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Preserve ASCII escapes even if a run contains invalid UTF-8 bytes.
      return encoded.replace(/%([0-9a-f]{2})/gi, (_, byte) =>
        String.fromCharCode(Number.parseInt(byte, 16)),
      );
    }
  });
}

async function* filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      yield* filesUnder(path);
    } else if (
      entry.isFile() &&
      extensions.has(extname(entry.name).toLowerCase())
    ) {
      yield path;
    }
  }
}

function* colourLiterals(source) {
  // Keywords such as transparent, currentColor and inherit do not match.
  const starts = /#(?:[a-f\d]{8}|[a-f\d]{6}|[a-f\d]{4}|[a-f\d]{3})(?![\w-])|\b(?:rgba?|hsla?)\s*\(/gi;

  for (const match of source.matchAll(starts)) {
    if (match[0].startsWith('#')) {
      yield match[0].toUpperCase();
      continue;
    }

    // Capture the complete call, including nested calc()/var() parentheses.
    let end = match.index + match[0].length;
    let depth = 1;
    while (end < source.length && depth > 0) {
      const character = source[end++];
      if (character === '(') depth++;
      else if (character === ')') depth--;
    }
    yield source.slice(match.index, end);
  }
}

async function main() {
  let fileCount = 0;
  let colourCount = 0;
  let offendingCount = 0;

  for await (const file of filesUnder(distDir)) {
    fileCount++;
    const source = decodePercentEscapes(await readFile(file, 'utf8'));
    const displayPath = relative(repoRoot, file).replaceAll('\\', '/');

    for (const literal of colourLiterals(source)) {
      colourCount++;
      // Only the four hex literals are whitelisted; functional forms fail.
      if (!allowed.has(literal) && !allowedFunctional.has(literal.toLowerCase())) {
        offendingCount++;
        console.error(`${displayPath}: ${JSON.stringify(literal)}`);
      }
    }
  }

  if (offendingCount > 0) {
    console.error(
      `Palette audit failed: ${offendingCount} offending literals; ${fileCount} files scanned.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `Palette audit passed: ${fileCount} files scanned, ${colourCount} approved colour literals.`,
  );
  process.exitCode = 0;
}

try {
  await main();
} catch (error) {
  console.error(`Palette audit failed: ${error.message}`);
  process.exitCode = 1;
}
