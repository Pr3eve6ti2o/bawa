// Type declarations for the sibling wasm-integrity.mjs (T47). The .mjs is a
// plain Node script (run directly by copy-wasm.mjs), so it carries no types
// of its own; without this file, `tsc --noEmit` (part of `npm run build`)
// fails with TS7016 on the test's import of the module.
export declare const EXPECTED_WASM_SHA256: string;
export declare function sha256Hex(data: Uint8Array): string;
export declare function verifyWasmHash(data: Uint8Array): boolean;
