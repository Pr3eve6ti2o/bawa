# P2b — Tests for the create-wallet step-4 fix (SELF-CONTAINED: you have no filesystem access, so work ONLY from the code pasted below and output ONLY the replacement text)

## Context
The screen `apps/web/src/screens/create-wallet.tsx` was already fixed (in the worktree): in `handleConfirm`, the `unlockVault` + `refreshVaultAccounts` calls are now inside an inner try/catch — if they throw AND `isLocked()` (from `'../wallet/vault'`) is true, the error is rethrown (unlock itself failed: outer catch shows the save error, stays on step 3); if the vault is unlocked, the error is swallowed and `setStep(4)` still runs (only the post-unlock refresh failed). The step indicator is `StepCard` components rendering `data-slot="step-card"` and `data-state` (`pending` | `active` | `completed`), four cards in step order 1–4. Step 4's card shows the addresses from `vaultAddresses`.

## Current test code (verbatim, the ONLY parts you may change)
Import + vault mock:
```tsx
import { createVault, hasVault } from '../wallet/vault';
```
```tsx
vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
}));
```

`beforeEach`:
```tsx
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(createWallet).mockResolvedValue(TEST_MNEMONIC);
  vi.mocked(createVault).mockResolvedValue(undefined);
  vi.mocked(hasVault).mockReturnValue(false);
  mockUnlockVault.mockResolvedValue(undefined);
  mockRefreshVaultAccounts.mockResolvedValue(undefined);
  vi.mocked(useWallet).mockReturnValue({
    vaultAddresses: TEST_ADDRESSES,
    unlockVault: mockUnlockVault,
    refreshVaultAccounts: mockRefreshVaultAccounts,
  } as unknown as ReturnType<typeof useWallet>);
});
```

Helpers already present (reuse them, do not redefine): `mountScreen()`, `generate(div)`, `findButton(div, text)`, `setInputValue(input, value)`, `TEST_MNEMONIC` (disposable test words), `TEST_PASSWORD`, `TEST_ADDRESSES` (`btc: ['bc1qtest']`, `eth: ['0xTestEthAddress']`, `trx: ['TTestTrxAddress']`, `ton: ['UQTestTonAddress']`), `mockUnlockVault`, `mockRefreshVaultAccounts`. The confirm-words flow (copy it from the existing test below): `generate(div)`, click `I have written them down`, read the three `input[id^="confirm-word-"]` inputs, fill each with `words[position]`, click `Confirm and create wallet`, all inside `act(async () => ...)`, wrapped in `try { ... } finally { await mounted.cleanup(); }`.

Existing test to extend (add assertions at its end, before the `finally`):
```tsx
  it('creates the vault with all four profileIds and clears the words', async () => {
    const mounted = await mountScreen();
    try {
      await generate(mounted.div);
      await act(async () => {
        findButton(mounted.div, 'I have written them down').click();
      });
      const words = TEST_MNEMONIC.split(' ');
      const inputs = [...mounted.div.querySelectorAll('input[id^="confirm-word-"]')];
      expect(inputs.length).toBe(3);
      await act(async () => {
        inputs.forEach((input) => {
          const position = Number(
            (input as HTMLInputElement).id.replace('confirm-word-', ''),
          );
          setInputValue(input as HTMLInputElement, words[position] as string);
        });
      });
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
        'bawa-btc-bip84-v1',
        'bawa-evm-bip44-v1',
        'bawa-trx-bip44-v1',
        'bawa-ton-v4r2-v1',
      ]);
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, '');
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      // The mnemonic is cleared: no recovery word is shown any more.
      expect(mounted.div.textContent).not.toContain('abandon');
      expect(mounted.div.textContent).toContain('Your wallet is ready');
      // Ethereum first.
      const text = mounted.div.textContent as string;
      expect(text.indexOf('Ethereum')).toBeLessThan(text.indexOf('Bitcoin'));
      expect(text.indexOf('Bitcoin')).toBeLessThan(text.indexOf('TRON'));
      expect(text.indexOf('TRON')).toBeLessThan(text.indexOf('TON'));
    } finally {
      await mounted.cleanup();
    }
  });
```

## Required changes (test file only; do not change the screen or any other file)
1. Import `isLocked` from `'../wallet/vault'` and add `isLocked: vi.fn()` to the vault mock factory. In `beforeEach`, default it with `vi.mocked(isLocked).mockReturnValue(false);` (vault unlocked after a successful creation).
2. Extend the existing test above: after the Ethereum-first assertions, assert the step indicator shows step 4 completed — query `mounted.div.querySelectorAll('[data-slot="step-card"]')`, expect 4 cards, the 4th has `data-state` `completed` and the 3rd has `data-state` `completed` — and assert all four `TEST_ADDRESSES` values appear in the page text.
3. New test `advances to step 4 with addresses when the post-unlock refresh fails`: same confirm-words flow with correct words, but before clicking confirm set `mockRefreshVaultAccounts.mockRejectedValueOnce(new Error('refresh failed'))`. Assert `createVault` was called once, the 4th step card has `data-state` `completed`, the page contains `Your wallet is ready` and all four `TEST_ADDRESSES` values, and the page does NOT contain `could not be saved`.
4. New test `stays on step 3 when the unlock itself fails`: same flow, but before clicking confirm set `mockUnlockVault.mockRejectedValueOnce(new Error('unlock failed'))` and `vi.mocked(isLocked).mockReturnValue(true)`. Assert the page contains `could not be saved`, the 4th step card has `data-state` `pending`, and the page does NOT contain `Your wallet is ready`.

## Deliverable (output file ONLY — you change no files yourself)
Output fenced code blocks and nothing else except a 3-line note after them: (1) the new import line, (2) the new mock factory, (3) the one `beforeEach` line to add, (4) the assertions to add to the existing test, (5) the two complete new tests. TypeScript + vitest, same style (2-space indent, single quotes). Use only the disposable test mnemonic above; no real secrets anywhere.

## Hard limits
No real crypto, disposable test credentials only, never real user funds or seed phrases. Never print, log, or include a private key or mnemonic.
