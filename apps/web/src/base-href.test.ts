// Regression test for the wallet-core WASM deep-route failure (T21).
//
// The Trust Wallet Core Emscripten loader fetches `wallet-core.wasm` from a
// bare relative URL, resolved against the document URL. Without a root base
// element, a full page load on a two-segment route (for example /assets/btc
// or /transactions/:id) fetched /assets/wallet-core.wasm, which the static
// host answers with index.html, so WASM initialisation failed and every
// derivation broke. Single-segment routes only worked by accident, because
// their directory is the site root.
//
// This test guards the HTML invariant only: exactly one <base href="/"> in
// <head>, before every other URL-bearing element. It does not assert any
// runtime WASM fetching, initialisation or navigation behaviour.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html'),
  'utf8',
);

// Strip HTML comments so apparent tags inside comments are not counted.
const withoutComments = indexHtml.replace(/<!--[\s\S]*?-->/g, '');

const headMatch = withoutComments.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
if (headMatch === null) {
  throw new Error('apps/web/index.html has no <head> element');
}
const head = headMatch[1]!;

const baseTags = [...head.matchAll(/<base\b[^>]*>/gi)];

describe('web document base (T21 WASM deep-route regression)', () => {
  it('has exactly one <base> element in <head>', () => {
    expect(baseTags).toHaveLength(1);
  });

  it('sets the base href to exactly "/"', () => {
    const tag = baseTags[0]![0];
    const href = tag.match(/href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/i)?.[1];
    expect(href).toBe('"/"');
  });

  it('places <base> before every other URL-bearing element', () => {
    const baseIndex = withoutComments.search(/<base\b[^>]*>/i);
    expect(baseIndex).toBeGreaterThanOrEqual(0);
    // Nothing URL-bearing (link[href], script[src]) may precede the base tag.
    const before = withoutComments.slice(0, baseIndex);
    expect(before).not.toMatch(/<link\b[^>]*href/i);
    expect(before).not.toMatch(/<script\b[^>]*src/i);
    // And at least one URL-bearing element exists after it (the app script),
    // so the ordering assertion is not vacuous.
    const after = withoutComments.slice(baseIndex);
    expect(after).toMatch(/<script\b[^>]*src/i);
  });
});
