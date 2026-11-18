Add the vault account/index selectors — wallet-management screen only.

In apps/web/src/screens/wallet-management.tsx, current head:
export function WalletManagementScreen() {
  const { xpubs, removeXpub } = useWallet();
  const hasWallets = chains.some(({ id }) => Boolean(xpubs[id]));
  return (
    <section className="space-y-6" aria-labelledby="wallets-heading">
      <h1 id="wallets-heading" className="text-2xl font-semibold">Wallets</h1>

Add a "Vault account" section directly below that <h1>, shown only when vaultState from useWallet() is 'unlocked'. It has two number inputs (ids "vault-account" and "vault-index", min 0, step 1) initialised from vaultAccount in the context, an Apply button calling setVaultAccount(account, index), and below it the four derived vault addresses for the selected account/index (from vaultAddresses in the context, labelled Bitcoin/Ethereum/TRON/TON with the address in monospace). Under the addresses, the honest note: "TON has one address per wallet — account and index do not change it."

Clamp invalid input (empty, negative, non-integer) to 0 before calling setVaultAccount. While the derivation runs, disable the Apply button and show "Loading…". Keep the existing watch-only cards and styling untouched. vaultAccount and setVaultAccount already exist in the context — do not touch core.ts or the context.

Return the exact changed hunks.
