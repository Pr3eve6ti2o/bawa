"""Lane A perf: apply Sol prompt-2b (lazy engine in wallet-context).

One deliberate deviation from Sol's output (recorded in RUN-LOG): in
refreshChain the dynamic boundary import is placed INSIDE the try block,
so a chunk-load failure lands as the chain error state instead of an
uncaught rejection out of refreshChain (callers await it via Promise.all).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p2b.py
"""
import sys

CTX = 'apps/web/src/state/wallet-context.tsx'

with open(CTX, encoding='utf-8') as f:
    src = f.read()

old1 = "import { deriveAddresses, validateWatchOnlyImport } from '../engine/boundary';\n"
assert src.count(old1) == 1, 'boundary import not found once'
src = src.replace(old1, '', 1)
old2 = "import { deriveAddressesAt as deriveVaultAddressesAt } from '../wallet/core';\n"
assert src.count(old2) == 1, 'core import not found once'
src = src.replace(old2, '', 1)

anchor = "import { isPassphraseUsed } from '../wallet/passphrase';"
assert src.count(anchor) == 1, 'passphrase import anchor not found once'
helper = anchor + """

let vaultCorePromise: Promise<typeof import('../wallet/core')> | undefined;

function loadVaultCore(): Promise<typeof import('../wallet/core')> {
  if (!vaultCorePromise) {
    vaultCorePromise = import('../wallet/core').catch((error: unknown) => {
      vaultCorePromise = undefined;
      throw error;
    });
  }
  return vaultCorePromise;
}
"""
src = src.replace(anchor, helper, 1)

old_chain = """    setChain(chain, 'loading');
    try {
      const addresses = await deriveAddresses(chain, wallet.xpub, wallet.derivedCount);"""
assert src.count(old_chain) == 1, 'refreshChain try not found once'
src = src.replace(
    old_chain,
    """    setChain(chain, 'loading');
    try {
      const { deriveAddresses } = await import('../engine/boundary');
      const addresses = await deriveAddresses(chain, wallet.xpub, wallet.derivedCount);""",
    1,
)

old_add = """    const publicKey = xpub.trim();
    const validation = await validateWatchOnlyImport(chain, publicKey);"""
assert src.count(old_add) == 1, 'addXpub validation not found once'
src = src.replace(
    old_add,
    """    const publicKey = xpub.trim();
    const { validateWatchOnlyImport } = await import('../engine/boundary');
    const validation = await validateWatchOnlyImport(chain, publicKey);""",
    1,
)

old_hyd = """      try {
        const validation = await validateWatchOnlyImport(chain, publicKey);"""
assert src.count(old_hyd) == 1, 'hydration validation not found once'
src = src.replace(
    old_hyd,
    """      try {
        const { validateWatchOnlyImport } = await import('../engine/boundary');
        const validation = await validateWatchOnlyImport(chain, publicKey);""",
    1,
)

old_drv = """    let derived: Record<ChainId, string>;
    try {
      derived = await vault.withMnemonic((mnemonic) =>
        deriveVaultAddressesAt("""
assert src.count(old_drv) == 1, 'refreshVaultAccounts derivation not found once'
src = src.replace(
    old_drv,
    """    let derived: Record<ChainId, string>;
    try {
      const { deriveAddressesAt: deriveVaultAddressesAt } = await loadVaultCore();
      derived = await vault.withMnemonic((mnemonic) =>
        deriveVaultAddressesAt(""",
    1,
)

with open(CTX, 'w', encoding='utf-8') as f:
    f.write(src)
print('wallet-context.tsx: engine lazy (boundary dynamic x3, loadVaultCore)')
print('OK')
