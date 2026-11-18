Add indexed-account derivation — core + context only, no UI in this step.

(1) apps/web/src/wallet/core.ts. Current account-0 derivation:
export async function deriveAddresses(mnemonic: string, passphrase = ''): Promise<WalletAddresses> {
  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
  ...
  const addressFor = (chain: ChainId): string =>
    checkedAddress(core, chain, wallet.getAddressForCoin(coinForChain(core, chain)));
  return { btc: addressFor('btc'), eth: addressFor('eth'), trx: addressFor('trx'), ton: addressFor('ton') };
}
Add deriveAddressesAt(mnemonic, passphrase, account, index): Promise<WalletAddresses> beside it. Validate: account and index are safe integers >= 0, index < 0x80000000 (unhardened, same bound as deriveFromXpub). For each chain take the path from pathFor(chain, account, index) in './chains' — except TON, which always uses m/44'/607'/0' and ignores account/index (one address per wallet). Derive with wallet.getKey(coin, path), then the per-chain pubkey form proven first-hand on Wallet Core 4.9.3: BTC getPublicKeySecp256k1(true) (33-byte compressed), ETH and TRX getPublicKeySecp256k1(false) (65-byte uncompressed), TON getPublicKeyEd25519(); then CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey) and the existing checkedAddress(). Delete every key and pubkey object. At account 0 index 0 the result must equal deriveAddresses() exactly.

(2) apps/web/src/state/wallet-context.tsx. Current derive line in refreshVaultAccounts():
derived = await vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic));
Add vaultAccount {account, index} state (default {account: 0, index: 0}) plus setVaultAccount(account, index): Promise<void> on the context value. refreshVaultAccounts() must derive with deriveAddressesAt(mnemonic, '', vaultAccount.account, vaultAccount.index) — pass '' as the passphrase for now (the passphrase lane wires the session passphrase later) and say so in a comment. Import deriveAddressesAt as deriveVaultAddressesAt from '../wallet/core'. setVaultAccount updates the account and re-derives (only when unlocked).

Return the new function plus the exact changed hunks. Do not change any screen.
