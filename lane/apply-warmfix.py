"""Lane A perf: warm-up must share loadCore's cached promise.

Measured regression: AFTER Slow 4G Generate took 104,731 ms (WASM 84,814 ms)
vs BEFORE 53,092 ms (WASM 52,423 ms). Cause: warmCore() issued its own
fetch() of wallet-core.wasm while loadCore() (create-screen mount preload
+ Generate) issued a second fetch of the same URL. Two 10.4 MB downloads
share the 1.6 Mbps pipe, so each takes ~2x. Fix: warm up by calling
loadCore(), whose promise is cached (and cleared on rejection, F-40), so
the idle warm-up, the mount preload and Generate all share ONE download
and ONE compile. warmCore() is deleted (its only caller was main.tsx).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-warmfix.py
"""


def patch(path, old, new, count=1):
    with open(path, encoding='utf-8') as f:
        src = f.read()
    found = src.count(old)
    assert found == count, f'{path}: expected {count} occurrence(s), found {found}'
    src = src.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(src)
    print(f'{path}: patched ({count})')


# --- main.tsx: warm via the shared loadCore() promise -------------------------
patch(
    'apps/web/src/main.tsx',
    """// Fetch the 10.4 MB wallet engine in the background once the browser is
// idle, so Generate in create-wallet pays compile only, not the download
// (measured 52.4 s on Slow 4G). The engine module is dynamic-imported so
// it never joins the first-paint chunk; this never blocks first paint.
function scheduleWarmCore(): void {
  const warm = () => {
    void import('./engine/boundary').then((m) => m.warmCore());
  };""",
    """// Start the 10.4 MB wallet engine in the background once the browser is
// idle, so Generate in create-wallet pays compile only, not the download
// (measured 52.4 s on Slow 4G). This MUST go through loadCore(): its
// promise is cached, so the idle warm-up, the create-screen mount preload
// and Generate share ONE download. A separate warm-up fetch races
// loadCore's fetch on the same URL and doubles the Slow 4G download
// (measured 84.8 s WASM / 104.7 s Generate after the first warm-up landed).
// The engine module is dynamic-imported so it never joins the first-paint
// chunk; this never blocks first paint. Failures are swallowed: Generate
// still loads the engine on demand.
function scheduleWarmCore(): void {
  const warm = () => {
    void import('./engine/boundary').then((m) => m.loadCore()).catch(() => {});
  };""",
)

# --- boundary.ts: delete warmCore (dead: only main.tsx called it) -------------
patch(
    'apps/web/src/engine/boundary.ts',
    """let wasmWarmPromise: Promise<void> | undefined;

// Prime the HTTP cache for wallet-core.wasm after first paint, so the
// create-wallet Generate step pays WASM compile only, not the 10.4 MB
// download (measured 52.4 s of a 53.1 s Generate step on Slow 4G).
// Fire-and-forget: failures are swallowed and loadCore() still fetches on
// demand. The URL resolves against document.baseURI, matching initWasm.
export function warmCore(): void {
  if (wasmWarmPromise !== undefined) return;
  if (typeof fetch !== 'function') return;
  wasmWarmPromise = (async () => {
    try {
      const url = new URL('wallet-core.wasm', globalThis.document.baseURI);
      const response = await fetch(url, { cache: 'default' });
      await response.arrayBuffer();
    } catch {
      // Offline or unreachable: loadCore() fetches on demand instead.
    }
  })();
}

""",
    "",
)

print('OK')
