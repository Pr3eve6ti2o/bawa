"""Lane A perf: apply Sol prompt-2a (lazy adapters) + required follow-ups.

- wallet-context.tsx: drop static getAdapter import, add ensureAdapters
  (exported, cached dynamic import + registerAllAdapters once), await it
  in refreshBalances / refreshHistory.
- main.tsx: stop statically importing/registering adapters at startup
  (ensureAdapters is now the single registration point).
- send.tsx: await ensureAdapters() at the start of handleAmountNext and
  handleSign, so the send flow never reads an unregistered adapter map.
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p2a.py
"""
import sys

CTX = 'apps/web/src/state/wallet-context.tsx'
MAIN = 'apps/web/src/main.tsx'
SEND = 'apps/web/src/screens/send.tsx'

with open(CTX, encoding='utf-8') as f:
    src = f.read()

old_import = "import { getAdapter } from '../wallet/adapters';\n"
assert src.count(old_import) == 1, 'getAdapter import not found once'
src = src.replace(old_import, '', 1)

anchor = "import { isPassphraseUsed } from '../wallet/passphrase';"
assert src.count(anchor) == 1, 'passphrase import anchor not found once'
ensure = anchor + """

let adaptersPromise: Promise<typeof import('../wallet/adapters')> | null = null;

// Lazy adapter loading: the adapter chunk (viem + adapters, ~3 MB) must not
// load before first paint. First caller imports it and registers the
// adapters once; concurrent callers share the promise. A rejected import
// clears the cache so a later call retries. Exported for the send screen,
// which also reads adapters but loads after the wallet context.
export function ensureAdapters(): Promise<typeof import('../wallet/adapters')> {
  if (adaptersPromise) return adaptersPromise;
  const promise = import('../wallet/adapters').then((adapters) => {
    adapters.registerAllAdapters();
    return adapters;
  });
  adaptersPromise = promise;
  void promise.catch(() => {
    if (adaptersPromise === promise) adaptersPromise = null;
  });
  return promise;
}
"""
src = src.replace(anchor, ensure, 1)

old_bal = "  const refreshBalances = useCallback(async () => {\n    await Promise.all(CHAINS.map(async (chain) => {"
assert src.count(old_bal) == 1, 'refreshBalances open not found once'
src = src.replace(
    old_bal,
    "  const refreshBalances = useCallback(async () => {\n    const { getAdapter } = await ensureAdapters();\n    await Promise.all(CHAINS.map(async (chain) => {",
    1,
)
old_hist = "  const refreshHistory = useCallback(async () => {\n    await Promise.all(CHAINS.map(async (chain) => {"
assert src.count(old_hist) == 1, 'refreshHistory open not found once'
src = src.replace(
    old_hist,
    "  const refreshHistory = useCallback(async () => {\n    const { getAdapter } = await ensureAdapters();\n    await Promise.all(CHAINS.map(async (chain) => {",
    1,
)
with open(CTX, 'w', encoding='utf-8') as f:
    f.write(src)
print('wallet-context.tsx: ensureAdapters + lazy getAdapter in both refreshers')

with open(MAIN, encoding='utf-8') as f:
    main = f.read()
old_main_import = "import { registerAllAdapters } from './wallet/adapters'\n"
assert main.count(old_main_import) == 1, 'main adapters import not found once'
main = main.replace(old_main_import, '', 1)
old_main_call = """// Phase 2 adapters (BTC/ETH/TRX/TON) are registered once, before render,
// so the wallet context can serve real balances and history.
registerAllAdapters();

"""
assert main.count(old_main_call) == 1, 'main register call not found once'
main = main.replace(old_main_call, '', 1)
with open(MAIN, 'w', encoding='utf-8') as f:
    f.write(main)
print('main.tsx: startup adapter registration removed')

with open(SEND, encoding='utf-8') as f:
    send = f.read()
old_send_import = "import { useWallet } from '../state/wallet-context';"
assert send.count(old_send_import) == 1, 'send useWallet import not found once'
send = send.replace(
    old_send_import,
    "import { ensureAdapters, useWallet } from '../state/wallet-context';",
    1,
)
old_amount = """  async function handleAmountNext(): Promise<void> {
    setPreviewBusy(true);
    try {
      const result = await previewSendAmount(chain, from, recipient, amount);"""
assert send.count(old_amount) == 1, 'handleAmountNext open not found once'
send = send.replace(
    old_amount,
    """  async function handleAmountNext(): Promise<void> {
    setPreviewBusy(true);
    try {
      try {
        await ensureAdapters();
      } catch {
        setPreview({ ok: false, reason: 'Balance adapters could not be loaded. Check your connection and retry.' });
        return;
      }
      const result = await previewSendAmount(chain, from, recipient, amount);""",
    1,
)
old_sign = """    if (!preview || !preview.ok) return;
    const previewOk = preview;
    setSignState({ status: 'signing' });"""
assert send.count(old_sign) == 1, 'handleSign open not found once'
send = send.replace(
    old_sign,
    """    if (!preview || !preview.ok) return;
    try {
      await ensureAdapters();
    } catch {
      setSignState({ status: 'error', reason: 'Balance adapters could not be loaded. Check your connection and retry.' });
      return;
    }
    const previewOk = preview;
    setSignState({ status: 'signing' });""",
    1,
)
with open(SEND, 'w', encoding='utf-8') as f:
    f.write(send)
print('send.tsx: ensureAdapters before preview + sign')
print('OK')
