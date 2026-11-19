"""Lane A perf: yieldFrame must not wait on rAF alone.

jsdom (and a backgrounded browser tab) never fires requestAnimationFrame,
so Sol 4a's yieldFrame hung handleGenerate forever in tests: the screen
never reached step 2. Race rAF against a 50 ms timeout; in a visible tab
rAF wins (~16 ms), elsewhere the timeout keeps the flow moving.
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-yieldframe.py
"""
SCREEN = 'apps/web/src/screens/create-wallet.tsx'

with open(SCREEN, encoding='utf-8') as f:
    src = f.read()

old = """function yieldFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve(undefined));
    } else {
      setTimeout(() => resolve(undefined), 0);
    }
  });
}"""
assert src.count(old) == 1, 'yieldFrame not found once'
src = src.replace(
    old,
    """function yieldFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        resolve(undefined);
      }
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => finish());
    }
    // rAF never fires in a background tab or a non-visual environment
    // (jsdom), so never wait on it alone: the timeout keeps the flow
    // moving. In a visible tab rAF wins (~16 ms).
    setTimeout(() => finish(), 50);
  });
}""",
    1,
)
with open(SCREEN, 'w', encoding='utf-8') as f:
    f.write(src)
print('create-wallet.tsx: yieldFrame races rAF against a 50ms timeout')
print('OK')
