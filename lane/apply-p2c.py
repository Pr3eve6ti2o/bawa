"""Lane A perf: apply Sol prompt-2c (background balances/history).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p2c.py
"""
CTX = 'apps/web/src/state/wallet-context.tsx'

with open(CTX, encoding='utf-8') as f:
    src = f.read()

old = """    // New vault addresses: refresh the adapter-backed balances + history.
    await refreshBalances();
    await refreshHistory();"""
assert src.count(old) == 1, 'refreshVaultAccounts tail not found once'
new = """    // Balances/history load in the background: this function returns as
    // soon as the derived addresses are in state, so the wallet shows
    // immediately. A failed background refresh leaves the per-chain
    // error/unavailable state (or the previous state) and the dashboard
    // Retry button re-runs it; it never throws here.
    void refreshBalances().catch(() => {});
    void refreshHistory().catch(() => {});"""
src = src.replace(old, new, 1)
with open(CTX, 'w', encoding='utf-8') as f:
    f.write(src)
print('wallet-context.tsx: balances/history now background in refreshVaultAccounts')
print('OK')
