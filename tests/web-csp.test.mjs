// Regression tests for the shipped web wallet's Content Security
// Policy (T49 F-02, as reconciled by the coordinator at merge time).
// The CSP is a required control per docs/web-wallet/WEB-GUIDE.md
// ("Ship and check the Content Security Policy"); the starter shipped
// without any policy, and scripts/generate-project.mjs propagates
// apps/web wholesale into every generated web project.
//
// T49 first fixed this with a CSP <meta> in SOURCE index.html. That
// form was NOT merged, for two first-hand-verified reasons:
//  - T47 (merged b5d619a) already delivers the CSP from a single shared
//    policy (apps/web/src/app/security-headers.ts): a build-time <meta>
//    injected into dist/index.html + preview.headers. A source meta
//    makes TWO metas in dist; their intersection blocks the app's
//    self-hosted fonts (the source meta has no font-src, so font-src
//    falls back to its default-src 'none'; the app @imports
//    @fontsource/inter + noto-sans).
//  - The source meta is also served in dev, where Vite injects an
//    inline react-refresh preamble, which script-src 'self' would
//    block — breaking `npm run dev` / HMR (T47's proven finding,
//    re-verified first-hand at merge time).
// F-02's intent — a CSP in the shipped app carrying the directives
// the WASM engine needs — is satisfied by T47's merged control, so
// these tests pin THAT control: the shared policy text, the
// build-time-only injection, and the absence of a source meta (dev
// stays clean, exactly one policy ships).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function read(rel) {
  return readFileSync(new URL(rel, import.meta.url), 'utf8');
}

describe('shipped web wallet Content Security Policy (T49 F-02)', () => {
  test('the shared policy carries the directives the WASM engine needs', () => {
    const policy = read('../apps/web/src/app/security-headers.ts');
    // base-uri is 'self', not 'none': the <base href="/"> element is
    // load-bearing for WASM deep-route loads (T21); 'none' would block
    // it. 'self' still blocks a cross-origin base hijack.
    for (const directive of [
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ]) {
      assert.ok(
        policy.includes(directive),
        'shared CSP policy must contain: ' + directive,
      );
    }
  });

  test('the policy is injected into dist at build time only, never in dev', () => {
    const config = read('../apps/web/vite.config.ts');
    assert.ok(
      config.includes('transformIndexHtml'),
      'vite.config.ts must inject the CSP meta at build time',
    );
    assert.ok(
      config.includes('if (ctx.server) return html'),
      'the injection must be skipped for the dev server (inline react-refresh preamble)',
    );
    assert.ok(
      config.includes('CONTENT_SECURITY_POLICY'),
      'the injected meta must come from the shared policy module',
    );
    assert.ok(
      config.includes('preview:') && config.includes('SECURITY_HEADERS'),
      'vite preview must serve the same policy as HTTP headers',
    );
  });

  test('source index.html carries no CSP meta (dev stays clean, one policy ships)', () => {
    const html = read('../apps/web/index.html');
    assert.ok(
      !html.includes('Content-Security-Policy'),
      'a source CSP meta would be served in dev (breaking HMR) and would double the shipped policy',
    );
    assert.ok(
      html.includes('<base href="/" />'),
      'the load-bearing <base> element must still be present (T21)',
    );
  });
});
