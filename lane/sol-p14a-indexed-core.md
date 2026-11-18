Add `pathFor` to the existing `./chains` import, then place this beside `deriveAddresses()`:

```ts
export async function deriveAddressesAt(
  mnemonic: string,
  passphrase: string,
  account: number,
  index: number,
): Promise<WalletAddresses> {
  if (!Number.isSafeInteger(account) || account < 0) {
    throw new RangeError('account must be a non-negative safe integer');
  }
  if (!Number.isSafeInteger(index) || index < 0 || index >= 0x80000000) {
    throw new RangeError(
      'index must be a non-negative safe integer below 0x80000000',
    );
  }

  const core = await loadCore();
  assertValidMnemonic(core, mnemonic);
  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);

  try {
    const addressFor = (chain: ChainId): string => {
      const coin = coinForChain(core, chain);
      const path =
        chain === 'ton' ? "m/44'/607'/0'" : pathFor(chain, account, index);
      const key = wallet.getKey(coin, path);

      try {
        const pubkey =
          chain === 'ton'
            ? key.getPublicKeyEd25519()
            : key.getPublicKeySecp256k1(chain === 'btc');

        try {
          return checkedAddress(
            core,
            chain,
            core.CoinTypeExt.deriveAddressFromPublicKey(coin, pubkey),
          );
        } finally {
          pubkey.delete();
        }
      } finally {
        key.delete();
      }
    };

    return {
      btc: addressFor('btc'),
      eth: addressFor('eth'),
      trx: addressFor('trx'),
      ton: addressFor('ton'),
    };
  } finally {
    wallet.delete();
  }
}
```

The supplied context derivation line changes as follows, with the new alias imported from `../wallet/core`:

```diff
- derived = await vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic));
+ // Empty passphrase for now; the passphrase lane will wire the session passphrase later.
+ derived = await vault.withMnemonic((mnemonic) =>
+   deriveVaultAddressesAt(
+     mnemonic,
+     '',
+     vaultAccount.account,
+     vaultAccount.index,
+   ),
+ );
```

**To provide the remaining exact context hunks, I need the current `wallet-context.tsx`**—particularly its context type, full `refreshVaultAccounts()`, unlock-state check, and context-value construction. Those weren’t supplied. The setter must pass or otherwise synchronously expose the new selection to refresh; simply setting React state and immediately calling a callback that captures `vaultAccount` would derive the previous account.

No screen changes are proposed.