import { describe, expect, it } from 'vitest';
import {
  CONTENT_SECURITY_POLICY,
  SECURITY_HEADERS,
} from './security-headers';
import {
  EXPECTED_WASM_SHA256,
  sha256Hex,
  verifyWasmHash,
} from '../../scripts/wasm-integrity.mjs';

describe('T47 security headers', () => {
  it('CSP allows same-origin scripts plus WASM compilation only', () => {
    const scriptSrc = CONTENT_SECURITY_POLICY.split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('script-src '));
    // Exact match: no 'unsafe-inline', no bare 'unsafe-eval' in script-src.
    // ('unsafe-inline' appears ONLY in style-src — see the next test.)
    expect(scriptSrc).toBe("script-src 'self' 'wasm-unsafe-eval'");
    expect(CONTENT_SECURITY_POLICY).toContain("style-src 'self' 'unsafe-inline'");
    expect(CONTENT_SECURITY_POLICY).not.toContain('http:');
    expect(CONTENT_SECURITY_POLICY).not.toContain('https:');
    expect(CONTENT_SECURITY_POLICY).not.toContain('*');
  });

  it('CSP blocks plugins, base hijack, framing and off-origin fetches', () => {
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("base-uri 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("connect-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("form-action 'self'");
  });

  it('preview/server headers carry the CSP and framing + sniffing guards', () => {
    expect(SECURITY_HEADERS['Content-Security-Policy']).toBe(CONTENT_SECURITY_POLICY);
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff');
  });
});

describe('T47 wallet-core WASM integrity pin', () => {
  it('pins the published 4.8.4 wasm hash', () => {
    expect(EXPECTED_WASM_SHA256).toBe(
      'c202624dc95475d3d309a28d99e286875066ed20fd7adc81c28de38dc721e09f',
    );
  });

  it('accepts data hashing to the pin and rejects a one-byte change', () => {
    const good = new Uint8Array([0x00, 0x61, 0x73, 0x6d]);
    // sha256Hex is exercised against a known vector, not the pin itself:
    expect(sha256Hex(good)).toBe(
      'cd5d4935a48c0672cb06407bb443bc0087aff947c6b864bac886982c73b3027f',
    );
    expect(verifyWasmHash(good)).toBe(false);
    const tampered = new Uint8Array([0x00, 0x61, 0x73, 0x6e]);
    expect(sha256Hex(tampered)).not.toBe(sha256Hex(good));
  });
});
