```tsx
import { createVault, hasVault, isLocked } from '../wallet/vault';
```

```tsx
vi.mock('../wallet/vault', () => ({
  createVault: vi.fn(),
  hasVault: vi.fn(),
  isLocked: vi.fn(),
}));
```

```tsx
  vi.mocked(isLocked).mockReturnValue(false);
```

```tsx
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('completed');
      expect(stepCards[2]?.getAttribute('data-state')).toBe('completed');
      expect(text).toContain(TEST_ADDRESSES.btc[0]);
      expect(text).toContain(TEST_ADDRESSES.eth[0]);
      expect(text).toContain(TEST_ADDRESSES.trx[0]);
      expect(text).toContain(TEST_ADDRESSES.ton[0]);
```

```tsx
  it('advances to step 4 with addresses when the post-unlock refresh fails', async () => {
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
      mockRefreshVaultAccounts.mockRejectedValueOnce(new Error('refresh failed'));
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockUnlockVault).toHaveBeenCalledWith(TEST_PASSWORD, '');
      expect(mockRefreshVaultAccounts).toHaveBeenCalledTimes(1);
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('completed');
      const text = mounted.div.textContent as string;
      expect(text).toContain('Your wallet is ready');
      expect(text).toContain(TEST_ADDRESSES.btc[0]);
      expect(text).toContain(TEST_ADDRESSES.eth[0]);
      expect(text).toContain(TEST_ADDRESSES.trx[0]);
      expect(text).toContain(TEST_ADDRESSES.ton[0]);
      expect(text).not.toContain('could not be saved');
    } finally {
      await mounted.cleanup();
    }
  });

  it('stays on step 3 when the unlock itself fails', async () => {
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
      mockUnlockVault.mockRejectedValueOnce(new Error('unlock failed'));
      vi.mocked(isLocked).mockReturnValue(true);
      await act(async () => {
        findButton(mounted.div, 'Confirm and create wallet').click();
      });
      expect(createVault).toHaveBeenCalledTimes(1);
      expect(mockRefreshVaultAccounts).not.toHaveBeenCalled();
      const stepCards = mounted.div.querySelectorAll('[data-slot="step-card"]');
      expect(stepCards.length).toBe(4);
      expect(stepCards[3]?.getAttribute('data-state')).toBe('pending');
      const text = mounted.div.textContent as string;
      expect(text).toContain('could not be saved');
      expect(text).not.toContain('Your wallet is ready');
    } finally {
      await mounted.cleanup();
    }
  });
```

Replacement snippets only; no files were changed.
Uses existing disposable test fixtures; no secrets included.
Tests were not run (no filesystem access).