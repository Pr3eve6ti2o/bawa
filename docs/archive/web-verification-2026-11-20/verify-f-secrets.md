# Verification Lane F - No secrets in requests, logs, or plaintext storage

- Scope: Bawa wallet-panel rebuild, Mandatory Correction SS6 item 8.
- Branch: `panel-rebuild/verify-secrets` (worktree
  `/home/boxd/workspace/bawa-panel-rebuild/verify-secrets/`).
- Base verified: `panel-rebuild/fix-adapters` at `fe6fd76`
  (`git log --oneline -1` = `fe6fd76 Fix Lane 2: Phase 2+3 evidence + 500s prompt re-split (final)`).
- Date: 2026-11-19. Method: hands-on greps and file inspection on the VM
  (muse-vm via boxd). Zero Sol calls in this lane.
- Test data note: the test files use published, disposable BIP-39 test
  vectors (never real secrets). Where a grep line would reconstruct a full
  test phrase it is redacted below and marked; no test-mnemonic or
  test-password value is quoted anywhere in this file.

## Verdict

**PASS** - No private key or mnemonic is sent in any backend request, written
to any log, or stored in persistent plaintext anywhere in `apps/web/src/` or
in the production build output at `fe6fd76`. No leak was found. See the
caveats at the end for the two honest limitations (label-length bound;
`withSigningKey` has no production caller yet in this tree).

## 1. Source-code grep

Command (run in the worktree):

```
grep -rn -i -E "mnemonic|seed|privateKey|private_key|xprv|secret" apps/web/src/
```

Result: **196 hits in 24 files.** Per-file counts:

```
23 apps/web/src/wallet/core.ts
22 apps/web/src/wallet/vault.test.ts
21 apps/web/src/wallet/vault.ts
21 apps/web/src/wallet/core.test.ts
20 apps/web/src/screens/import-wallet.test.tsx
19 apps/web/src/screens/import-wallet.tsx
17 apps/web/src/screens/create-wallet.tsx
11 apps/web/src/state/wallet-context.tsx
 6 apps/web/src/wallet/wallet-context.test.tsx
 6 apps/web/src/screens/create-wallet.test.tsx
 5 apps/web/src/wallet/wallet-context-balances.test.tsx
 5 apps/web/src/screens/mnemonic-backup.test.tsx
 3 apps/web/src/engine/boundary.ts
 3 apps/web/src/engine/boundary.test.ts
 3 apps/web/src/app/app.tsx
 2 apps/web/src/wallet/adapters/types.ts
 2 apps/web/src/screens/welcome.tsx
 2 apps/web/src/screens/security-settings.tsx
 2 apps/web/src/screens/mnemonic-backup.tsx
 1 apps/web/src/screens/wallet-management.tsx
 1 apps/web/src/engine/keccak.ts
 1 apps/web/src/engine/confirmation-policy.ts
```

Full output (two lines redacted as noted above):

```
apps/web/src/app/app.tsx:7:import { MnemonicBackupScreen } from '../screens/mnemonic-backup';
apps/web/src/app/app.tsx:34:  { to: '/mnemonic-backup', label: 'Mnemonic backup' },
apps/web/src/app/app.tsx:168:            <Route path="mnemonic-backup" element={<MnemonicBackupScreen />} />
apps/web/src/state/wallet-context.tsx:15:// r2b Fix (b)). The shortest 12-word English BIP-39 mnemonic is 47
apps/web/src/state/wallet-context.tsx:16:// characters, an xprv is 111, and a 32-byte data key in hex is 64, so
apps/web/src/state/wallet-context.tsx:17:// no complete secret of those forms fits in 40 characters, while
apps/web/src/state/wallet-context.tsx:19:// guarantee: a shorter complete secret (e.g. a 23-character Chinese
apps/web/src/state/wallet-context.tsx:20:// BIP-39 mnemonic, a 40-character Z85 key) or a secret fragment still
apps/web/src/state/wallet-context.tsx:22:// localStorage contains public watch-only data only (xpubs and labels), never secrets.
apps/web/src/state/wallet-context.tsx:63:  // (account 0, index 0), safe in state. The mnemonic never enters state.
apps/web/src/state/wallet-context.tsx:109:  // No state or refs may hold a mnemonic, seed, private key, private extended key,
apps/web/src/state/wallet-context.tsx:292:  // spending requires vault creation or mnemonic restoration. Watch-only xpubs
apps/web/src/state/wallet-context.tsx:309:      derived = await vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic));
apps/web/src/state/wallet-context.tsx:391:      // a pasted secret is not kept. The persistence effect below then
apps/web/src/engine/boundary.ts:322:// prefix are secret-like and rejected without echoing the input.
apps/web/src/engine/boundary.ts:330:  if (/\s/.test(value) || /^(?:xprv|zprv|tprv|yprv)/i.test(value)) {
apps/web/src/engine/boundary.ts:333:      reason: 'secret-like',
apps/web/src/engine/boundary.test.ts:156:    const privateKeyVector = mutatePayload(ethXpub, (payload) => {
apps/web/src/engine/boundary.test.ts:161:      validateExtendedKey(privateKeyVector, 'eth'),
apps/web/src/engine/boundary.test.ts:427: [LINE REDACTED - reconstructs a public BIP-39 test vector; see source file]
apps/web/src/engine/confirmation-policy.ts:11:// network access, holds no secrets, and never sends, signs or broadcasts
apps/web/src/engine/keccak.ts:10:// no secrets. Correctness is pinned by the published test vectors in
apps/web/src/screens/mnemonic-backup.test.tsx:25:// Standard public BIP-39 test vector — disposable test data, never a real secret.
apps/web/src/screens/mnemonic-backup.test.tsx:26:const TEST_MNEMONIC =
apps/web/src/screens/mnemonic-backup.test.tsx:44:  window.history.pushState({}, '', '/mnemonic-backup');
apps/web/src/screens/mnemonic-backup.test.tsx:68:describe.sequential('MnemonicBackupScreen (Phase 1.3)', () => {
apps/web/src/screens/mnemonic-backup.test.tsx:92:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/screens/import-wallet.test.tsx:26:// Published BIP-39 test mnemonic (construction redacted - public BIP-39 test vector) — a test vector
apps/web/src/screens/import-wallet.test.tsx:29: [LINE REDACTED - reconstructs a public BIP-39 test vector in code form; see source file]
apps/web/src/screens/import-wallet.test.tsx:123:  it('clears a rejected mnemonic on the TON tab and shows a secret-free error', async () => {
apps/web/src/screens/import-wallet.test.tsx:130:        setInputValue(input!, TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:132:      expect(input!.value).toBe(TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:141:      expect(div.textContent).not.toContain(TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:142:      expect(div.innerHTML).not.toContain(TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:150:  it('clears a pasted mnemonic from the field when validation rejects it', async () => {
apps/web/src/screens/import-wallet.test.tsx:169:        setInputValue(input!, TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:171:      expect(input!.value).toBe(TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:187:      expect(div.textContent).not.toContain(TEST_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:205:  it('shows the do-not-enter-secrets label guidance (R02-F09)', async () => {
apps/web/src/screens/import-wallet.test.tsx:219:      expect(div.textContent).toContain('do not enter secrets');
apps/web/src/screens/import-wallet.test.tsx:239:  // Standard public BIP-39 test vector — disposable test data, never a real secret.
apps/web/src/screens/import-wallet.test.tsx:240:  const VALID_MNEMONIC =
apps/web/src/screens/import-wallet.test.tsx:345:      await restorePhrase(div, VALID_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:351:      expect(div.textContent).not.toContain(VALID_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:352:      const expected = await deriveAddresses(VALID_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:371:      await restorePhrase(div, VALID_MNEMONIC);
apps/web/src/screens/import-wallet.test.tsx:392:      expect(div.textContent).not.toContain(VALID_MNEMONIC);
apps/web/src/screens/import-wallet.tsx:5:// key) keeps the existing behaviour exactly: a mnemonic, seed or private key
apps/web/src/screens/import-wallet.tsx:6:// must never be pasted there — secret-like input is rejected and cleared at
apps/web/src/screens/import-wallet.tsx:77:  const [normalizedMnemonic, setNormalizedMnemonic] = useState<string | null>(null);
apps/web/src/screens/import-wallet.tsx:89:    setNormalizedMnemonic(null);
apps/web/src/screens/import-wallet.tsx:116:      setNormalizedMnemonic(restored);
apps/web/src/screens/import-wallet.tsx:120:      setNormalizedMnemonic(null);
apps/web/src/screens/import-wallet.tsx:132:    if (isSaving || normalizedMnemonic === null) return;
apps/web/src/screens/import-wallet.tsx:145:      const mnemonic = normalizedMnemonic;
apps/web/src/screens/import-wallet.tsx:146:      await createVault(mnemonic, vaultPassword, profileIds);
apps/web/src/screens/import-wallet.tsx:147:      setNormalizedMnemonic(null);
apps/web/src/screens/import-wallet.tsx:154:      setNormalizedMnemonic(null);
apps/web/src/screens/import-wallet.tsx:168:    // T41: clear the draft immediately. A pasted mnemonic or private key
apps/web/src/screens/import-wallet.tsx:180:      setError(`${validation.message || (chain === 'ton' ? 'Invalid TON address.' : 'Invalid extended public key.')} The input was cleared; never paste a mnemonic, seed or private key here.`);
apps/web/src/screens/import-wallet.tsx:189:        // Secret-free error: never echo the rejected input back.
apps/web/src/screens/import-wallet.tsx:190:        setError(`Invalid ${chain === 'ton' ? 'TON address' : 'extended public key'}. The input was cleared; never paste a mnemonic, seed or private key here.`);
apps/web/src/screens/import-wallet.tsx:390:              <Link to="/mnemonic-backup">Review your backup checklist</Link>
apps/web/src/screens/import-wallet.tsx:399:            Only extended PUBLIC keys or TON public addresses are accepted. Private extended keys (xprv/zprv)
apps/web/src/screens/import-wallet.tsx:401:            Never paste a mnemonic, seed or private key here.
apps/web/src/screens/import-wallet.tsx:468:              <p className="text-xs text-muted-foreground">Labels are stored in plain text in this browser — do not enter secrets.</p>
apps/web/src/screens/mnemonic-backup.tsx:29:export function MnemonicBackupScreen() {
apps/web/src/screens/mnemonic-backup.tsx:40:          <CardTitle>Mnemonic backup</CardTitle>
apps/web/src/screens/welcome.tsx:27:          public keys and never holds secrets.
apps/web/src/screens/welcome.tsx:58:              Never paste recovery words, seeds or private keys.
apps/web/src/screens/security-settings.tsx:18:          <li>No mnemonic generation or storage.</li>
apps/web/src/screens/security-settings.tsx:58:            to="/mnemonic-backup"
apps/web/src/screens/wallet-management.tsx:88:        Only extended public keys and TON public addresses are stored (in localStorage). No secrets are stored anywhere in this starter.
apps/web/src/screens/create-wallet.tsx:1:// The mnemonic lives in this screen's local state ONLY during write-down
apps/web/src/screens/create-wallet.tsx:4:// No secret is ever logged.
apps/web/src/screens/create-wallet.tsx:58:  const [mnemonic, setMnemonic] = useState<string | null>(null);
apps/web/src/screens/create-wallet.tsx:64:  // Clear the mnemonic when the screen unmounts.
apps/web/src/screens/create-wallet.tsx:66:    setMnemonic(null);
apps/web/src/screens/create-wallet.tsx:73:  const words = mnemonic === null ? [] : mnemonic.split(' ');
apps/web/src/screens/create-wallet.tsx:98:      setMnemonic(generated);
apps/web/src/screens/create-wallet.tsx:103:      setMnemonic(null);
apps/web/src/screens/create-wallet.tsx:112:    if (isBusy || mnemonic === null) return;
apps/web/src/screens/create-wallet.tsx:127:      await createVault(mnemonic, password, profileIds);
apps/web/src/screens/create-wallet.tsx:128:      setMnemonic(null);
apps/web/src/screens/create-wallet.tsx:135:      // The mnemonic is already cleared above when creation succeeded;
apps/web/src/screens/create-wallet.tsx:137:      setMnemonic(null);
apps/web/src/screens/create-wallet.tsx:269:              . Never paste a mnemonic, seed or private key into this app.
apps/web/src/screens/create-wallet.tsx:275:      {step === 2 && mnemonic !== null && (
apps/web/src/screens/create-wallet.tsx:314:      {step === 3 && mnemonic !== null && (
apps/web/src/screens/create-wallet.tsx:377:              <Link to="/mnemonic-backup">Review your backup checklist</Link>
apps/web/src/screens/create-wallet.test.tsx:27:// Disposable test mnemonic — never a real secret.
apps/web/src/screens/create-wallet.test.tsx:28: [LINE REDACTED - reconstructs a public BIP-39 test vector in code form; see source file]
apps/web/src/screens/create-wallet.test.tsx:109:  vi.mocked(createWallet).mockResolvedValue(TEST_MNEMONIC);
apps/web/src/screens/create-wallet.test.tsx:175:      const words = TEST_MNEMONIC.split(' ');
apps/web/src/screens/create-wallet.test.tsx:190:      expect(createVault).toHaveBeenCalledWith(TEST_MNEMONIC, TEST_PASSWORD, [
apps/web/src/screens/create-wallet.test.tsx:198:      // The mnemonic is cleared: no recovery word is shown any more.
apps/web/src/wallet/wallet-context.test.tsx:17:// Standard public BIP-39 test vector — disposable test data, never a real secret.
apps/web/src/wallet/wallet-context.test.tsx:18:const TEST_MNEMONIC =
apps/web/src/wallet/wallet-context.test.tsx:86:        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/wallet-context.test.tsx:93:      const expected = await deriveAddresses(TEST_MNEMONIC);
apps/web/src/wallet/wallet-context.test.tsx:117:        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/wallet-context.test.tsx:136:        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.ts:4: * Follows OneKey's secret-envelope layering and MetaMask keyring-controller's
apps/web/src/wallet/vault.ts:7: * — never a mnemonic, seed, key or password.
apps/web/src/wallet/vault.ts:9: * The decrypted mnemonic lives only transiently in this module's closure
apps/web/src/wallet/vault.ts:42:let unlockedMnemonic: string | null = null;
apps/web/src/wallet/vault.ts:124:  mnemonic: string,
apps/web/src/wallet/vault.ts:134:    new TextEncoder().encode(mnemonic),
apps/web/src/wallet/vault.ts:150:/** Creates a vault. Throws if a vault already exists or the mnemonic is empty. */
apps/web/src/wallet/vault.ts:152:  mnemonic: string,
apps/web/src/wallet/vault.ts:156:  if (mnemonic.length === 0) {
apps/web/src/wallet/vault.ts:157:    throw new Error('Mnemonic must not be empty.');
apps/web/src/wallet/vault.ts:165:  const envelope = await encryptEnvelope(mnemonic, password, profileIds);
apps/web/src/wallet/vault.ts:222:  unlockedMnemonic = new TextDecoder().decode(plaintext);
apps/web/src/wallet/vault.ts:225:/** Locks the vault, dropping every reference to the key and the mnemonic. */
apps/web/src/wallet/vault.ts:228:  unlockedMnemonic = null;
apps/web/src/wallet/vault.ts:232: * Runs a callback with the decrypted mnemonic while the vault is unlocked.
apps/web/src/wallet/vault.ts:233: * Throws when locked. The mnemonic reference is dropped when the callback
apps/web/src/wallet/vault.ts:236:export function withMnemonic<T>(fn: (mnemonic: string) => T): T {
apps/web/src/wallet/vault.ts:237:  if (unlockedMnemonic === null) {
apps/web/src/wallet/vault.ts:240:  return fn(unlockedMnemonic);
apps/web/src/wallet/vault.ts:261:  const mnemonic = unlockedMnemonic as string;
apps/web/src/wallet/vault.ts:262:  const next = await encryptEnvelope(mnemonic, newPassword, envelope.profileIds);
apps/web/src/wallet/core.test.ts:21:const ETH_VECTOR_MNEMONIC =
apps/web/src/wallet/core.test.ts:26:  it('creates a fresh 24-word mnemonic from CSPRNG entropy', async () => {
apps/web/src/wallet/core.test.ts:27:    const mnemonic = await createWallet();
apps/web/src/wallet/core.test.ts:28:    expect(mnemonic.split(' ')).toHaveLength(24);
apps/web/src/wallet/core.test.ts:30:    expect(core.Mnemonic.isValid(mnemonic)).toBe(true);
apps/web/src/wallet/core.test.ts:34:    const mnemonic = await createWallet();
apps/web/src/wallet/core.test.ts:35:    const first = await deriveAddresses(mnemonic);
apps/web/src/wallet/core.test.ts:36:    const restored = await restoreWallet(mnemonic);
apps/web/src/wallet/core.test.ts:37:    expect(restored).toBe(mnemonic);
apps/web/src/wallet/core.test.ts:48:    const addresses = await deriveAddresses(ETH_VECTOR_MNEMONIC, 'TREZOR');
apps/web/src/wallet/core.test.ts:52:  it('rejects invalid mnemonics', async () => {
apps/web/src/wallet/core.test.ts:54:      'Invalid mnemonic.',
apps/web/src/wallet/core.test.ts:56:    await expect(restoreWallet('not a mnemonic')).rejects.toThrow(
apps/web/src/wallet/core.test.ts:57:      'Invalid mnemonic.',
apps/web/src/wallet/core.test.ts:60:      'Invalid mnemonic.',
apps/web/src/wallet/core.test.ts:88:    const mnemonic = await createWallet();
apps/web/src/wallet/core.test.ts:89:    const wallet = core.HDWallet.createWithMnemonic(mnemonic, '');
apps/web/src/wallet/core.test.ts:131:    const mnemonic = await createWallet();
apps/web/src/wallet/core.test.ts:132:    const wallet = core.HDWallet.createWithMnemonic(mnemonic, '');
apps/web/src/wallet/core.test.ts:175:    const mnemonic = await createWallet();
apps/web/src/wallet/core.test.ts:179:      mnemonic,
apps/web/src/wallet/vault.test.ts:16:  withMnemonic,
apps/web/src/wallet/vault.test.ts:19:// Standard public BIP-39 test vector — disposable test data, never a real secret.
apps/web/src/wallet/vault.test.ts:20:const TEST_MNEMONIC =
apps/web/src/wallet/vault.test.ts:49:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:55:  it('stores only an encrypted envelope, never plaintext secrets', async () => {
apps/web/src/wallet/vault.test.ts:56:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:73:  it('unlocks with the right password and exposes the mnemonic only while unlocked', async () => {
apps/web/src/wallet/vault.test.ts:74:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:77:    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
apps/web/src/wallet/vault.test.ts:80:    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
apps/web/src/wallet/vault.test.ts:84:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:89:    expect(() => withMnemonic((m) => m)).toThrow('Vault is locked.');
apps/web/src/wallet/vault.test.ts:93:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:95:      createVault(TEST_MNEMONIC, 'another password', TEST_PROFILES),
apps/web/src/wallet/vault.test.ts:99:  it('refuses empty mnemonic and password', async () => {
apps/web/src/wallet/vault.test.ts:101:      'Mnemonic must not be empty.',
apps/web/src/wallet/vault.test.ts:103:    await expect(createVault(TEST_MNEMONIC, '', TEST_PROFILES)).rejects.toThrow(
apps/web/src/wallet/vault.test.ts:109:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:114:    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
apps/web/src/wallet/vault.test.ts:118:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:132:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/vault.test.ts:143:    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/adapters/types.ts:6: * mainnet providers: they take public addresses only and never see a seed,
apps/web/src/wallet/adapters/types.ts:7: * mnemonic, private key or xpub. Chain identity is checked, never inferred
apps/web/src/wallet/wallet-context-balances.test.tsx:17:// Standard public BIP-39 test vector — disposable test data, never a real secret.
apps/web/src/wallet/wallet-context-balances.test.tsx:18:const TEST_MNEMONIC =
apps/web/src/wallet/wallet-context-balances.test.tsx:144:        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/wallet-context-balances.test.tsx:186:        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/wallet-context-balances.test.tsx:211:        await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
apps/web/src/wallet/core.ts:35:function assertValidMnemonic(core: WalletCore, mnemonic: string): void {
apps/web/src/wallet/core.ts:36:  if (!core.Mnemonic.isValid(mnemonic)) {
apps/web/src/wallet/core.ts:37:    throw new Error('Invalid mnemonic.');
apps/web/src/wallet/core.ts:137:/** Generate a 24-word mnemonic from 256 bits of secure entropy. */
apps/web/src/wallet/core.ts:160:      return wallet.mnemonic();
apps/web/src/wallet/core.ts:169:/** Validate and restore a mnemonic without retaining a WASM wallet object. */
apps/web/src/wallet/core.ts:171:  mnemonic: string,
apps/web/src/wallet/core.ts:175:  assertValidMnemonic(core, mnemonic);
apps/web/src/wallet/core.ts:177:  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
apps/web/src/wallet/core.ts:183:    return wallet.mnemonic();
apps/web/src/wallet/core.ts:195:  mnemonic: string,
apps/web/src/wallet/core.ts:199:  assertValidMnemonic(core, mnemonic);
apps/web/src/wallet/core.ts:201:  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
apps/web/src/wallet/core.ts:278: * retain, copy, log, or transfer the supplied secret buffer.
apps/web/src/wallet/core.ts:281:  mnemonic: string,
apps/web/src/wallet/core.ts:285:  fn: (privateKeyBytes: Uint8Array) => T | PromiseLike<T>,
apps/web/src/wallet/core.ts:288:  assertValidMnemonic(core, mnemonic);
apps/web/src/wallet/core.ts:290:  const wallet = core.HDWallet.createWithMnemonic(mnemonic, passphrase);
apps/web/src/wallet/core.ts:296:    const privateKey = wallet.getKey(coin, path);
apps/web/src/wallet/core.ts:297:    if (!privateKey) {
apps/web/src/wallet/core.ts:302:      // Use the returned bytes directly, avoiding an additional secret copy.
apps/web/src/wallet/core.ts:303:      const bytes = privateKey.data();
apps/web/src/wallet/core.ts:315:      privateKey.delete();
```

### Classification of every hit

Classes: (a) doc comment / UI copy / identifier stating the no-secrets
policy; (b) in-memory-only holder, never persisted, logged or sent;
(c) LEAK. No (c) hits exist.

- `app/app.tsx` (3) - (a) route import/label for `MnemonicBackupScreen`.
- `state/wallet-context.tsx` (11) - (a) header comment: 40-char label bound
  rationale + "localStorage contains public watch-only data only (xpubs and
  labels), never secrets"; "The mnemonic never enters state" (line 63);
  "No state or refs may hold a mnemonic, seed, private key, private
  extended key, vault key or data key" (line 109). (b) line 309: the single
  production `withMnemonic` call,
  `vault.withMnemonic((mnemonic) => deriveVaultAddresses(mnemonic))` -
  derives public addresses only; the returned addresses (not the mnemonic)
  enter state.
- `engine/boundary.ts` (3) - (a) guard: secret-like input (whitespace or
  `xprv|zprv|tprv|yprv` prefix) is rejected without echoing the input
  (lines 322-333). This is the defence, not a leak.
- `engine/boundary.test.ts` (3) - test-only (vectors/names).
- `engine/confirmation-policy.ts` (1) - (a) "holds no secrets".
- `engine/keccak.ts` (1) - (a) "no secrets".
- `screens/mnemonic-backup.tsx` (2) - (a) screen name/title.
- `screens/mnemonic-backup.test.tsx` (5) - test-only.
- `screens/import-wallet.tsx` (19) - (b) `normalizedMnemonic` React local
  state only: set on restore, cleared on unmount (lines 89-90), on any
  error, and immediately after `createVault` succeeds (lines 145-154).
  `phrase` input state is cleared immediately on submit (line ~111).
  Watch-only path clears the draft on submit and on rejection, and errors
  never echo the rejected input (lines 168-190). (a) UI copy: "Never paste
  a mnemonic, seed or private key here", "Labels are stored in plain text
  in this browser - do not enter secrets."
- `screens/import-wallet.test.tsx` (20) - test-only, including assertions
  that the DOM never contains the test phrase after restore/rejection.
- `screens/create-wallet.tsx` (17) - (b) `mnemonic` React local state
  only: cleared on unmount (lines 64-66), on any error, and immediately
  after `createVault` (lines 127-137). File header: "The mnemonic lives in
  this screen's local state ONLY during write-down and confirmation, never
  in context, storage or logs." (a) UI copy.
- `screens/create-wallet.test.tsx` (6) - test-only.
- `screens/welcome.tsx` (2), `screens/security-settings.tsx` (2),
  `screens/wallet-management.tsx` (1) - (a) UI copy ("public keys and never
  holds secrets", "No mnemonic generation or storage", "No secrets are
  stored anywhere in this starter").
- `wallet/core.ts` (23) - (b) `createWallet` (CSPRNG 32-byte entropy,
  `entropy.fill(0)` after use, WASM wallet `delete()`d), `restoreWallet` /
  `deriveAddresses` (mnemonic is a function argument; WASM wallet
  `delete()`d in `finally`), `withSigningKey` (lines 278-317): private-key
  bytes handed to the callback only, `bytes.fill(0)` in `finally`,
  `privateKey.delete()`, `wallet.delete()`. No logging, no storage, no
  network in this file.
- `wallet/core.test.ts` (21) - test-only (incl. the only `withSigningKey`
  caller anywhere: the test at line 178).
- `wallet/vault.ts` (21) - (b) `unlockedMnemonic` module-closure variable,
  set only by `unlock()`, dropped by `lock()` (lines 225-229); `withMnemonic`
  hands it to a callback and documents "callers must not retain or log it".
  The stored envelope holds version + KDF params + salt + IV + ciphertext
  + profileIds only (lines 1-14). (a) header policy comment.
- `wallet/vault.test.ts` (22) - test-only, incl. the envelope assertion
  (see section 3).
- `wallet/wallet-context.test.tsx` (6),
  `wallet/wallet-context-balances.test.tsx` (5) - test-only.
- `wallet/adapters/types.ts` (2) - (a) "they take public addresses only
  and never see a seed, mnemonic, private key or xpub" (lines 6-7).

Files with ZERO hits (checked by the same grep): `wallet/adapters/btc.ts`,
`wallet/adapters/eth.ts`, `wallet/adapters/trx.ts`,
`wallet/adapters/ton.ts`, `wallet/providers.ts`, `wallet/chains.ts`,
`wallet/format.ts`, `wallet/qr-scanner.tsx`, `screens/receive.tsx`,
`screens/send.tsx`, `screens/asset-detail.tsx`, `screens/dashboard.tsx`,
`screens/transaction-history.tsx`, and all other screens/components. The
whole network layer contains no secret-pattern hit at all.

Extra greps: `StoredKey|exportMnemonic|decryptMnemonic` in non-test src -
zero hits (those names exist only in the bundled Wallet Core library code,
see section 4). `passphrase|password` in wallet/screens/state - only vault
KDF/password parameters and UI copy; no password is stored (see section 3).

## 2. Network requests

Raw `fetch(`/`axios`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` grep over
non-test `apps/web/src/`:

```
grep -rn -E "fetch\(|axios|WebSocket|sendBeacon|XMLHttpRequest" apps/web/src/ | grep -v test
```

returns exactly ONE site: `wallet/adapters/types.ts:104`, inside the shared
`fetchJson(url, init?, timeoutMs?)` helper (single-attempt, 10 s timeout, no
retries). Every adapter request goes through it, except ETH balance/nonce
which go through a viem public client. Full request-site list:

```
apps/web/src/wallet/providers.ts:19:  getBalance(chain: ChainId, address: string): Promise<BalanceResult>;
apps/web/src/wallet/providers.ts:32:export function getBalanceProvider(
apps/web/src/wallet/adapters/btc.test.ts:36:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/btc.test.ts:53:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/btc.test.ts:60:    const result = await adapter.getBalance('not-a-bitcoin-address');
apps/web/src/wallet/adapters/btc.test.ts:67:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/ton.test.ts:42:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/ton.test.ts:54:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/ton.test.ts:61:    const result = await adapter.getBalance('not-a-ton-address');
apps/web/src/wallet/adapters/ton.test.ts:75:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/types.ts:79:  getBalance(address: string): Promise<AdapterResult<AdapterBalance>>;
apps/web/src/wallet/adapters/types.ts:94:export async function fetchJson(
apps/web/src/wallet/adapters/types.ts:104:      response = await fetch(url, { ...init, signal: controller.signal });
apps/web/src/wallet/adapters/types.ts:141: * getBalanceProvider path. Ok maps to {value}; unavailable/error throw, so
apps/web/src/wallet/adapters/types.ts:147:    getBalance: async (_chain: ChainId, address: string) => {
apps/web/src/wallet/adapters/types.ts:148:      const result = await adapter.getBalance(address);
apps/web/src/wallet/adapters/trx.ts:3:  fetchJson,
apps/web/src/wallet/adapters/trx.ts:48:      raw = await fetchJson(`${baseUrl}/wallet/getnowblock`);
apps/web/src/wallet/adapters/trx.ts:68:  const getBalance = async (
apps/web/src/wallet/adapters/trx.ts:78:      raw = await fetchJson(`${baseUrl}/v1/accounts/${address}`);
apps/web/src/wallet/adapters/trx.ts:121:      raw = await fetchJson(
apps/web/src/wallet/adapters/trx.ts:185:      raw = await fetchJson(`${baseUrl}/wallet/getchainparameters`);
apps/web/src/wallet/adapters/trx.ts:221:    const balance = await getBalance(address);
apps/web/src/wallet/adapters/trx.ts:238:    getBalance,
apps/web/src/wallet/adapters/trx.test.ts:44:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/trx.test.ts:56:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/trx.test.ts:63:    const result = await adapter.getBalance('not-a-tron-address');
apps/web/src/wallet/adapters/trx.test.ts:70:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/btc.ts:4:  fetchJson,
apps/web/src/wallet/adapters/btc.ts:53:      raw = await fetchJson(`${baseUrl}/v1/blocks/0`);
apps/web/src/wallet/adapters/btc.ts:74:  const getBalance = async (
apps/web/src/wallet/adapters/btc.ts:84:      raw = await fetchJson(`${baseUrl}/address/${address}`);
apps/web/src/wallet/adapters/btc.ts:127:      raw = await fetchJson(`${baseUrl}/address/${address}/txs`);
apps/web/src/wallet/adapters/btc.ts:212:      raw = await fetchJson(`${baseUrl}/v1/fees/recommended`);
apps/web/src/wallet/adapters/btc.ts:246:      raw = await fetchJson(`${baseUrl}/address/${address}/utxo`);
apps/web/src/wallet/adapters/btc.ts:277:    getBalance,
apps/web/src/wallet/adapters/eth.test.ts:12:    getBalance: vi.fn(async () => 1000000000000000000n),
apps/web/src/wallet/adapters/eth.test.ts:38:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/eth.test.ts:49:      client: mockClient({ getBalance: vi.fn(async () => 0n) }),
apps/web/src/wallet/adapters/eth.test.ts:51:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/eth.test.ts:58:    const result = await adapter.getBalance('not-an-address');
apps/web/src/wallet/adapters/eth.test.ts:66:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/eth.test.ts:74:        getBalance: vi.fn(async () => { throw new Error('rpc down'); }),
apps/web/src/wallet/adapters/eth.test.ts:77:    const result = await adapter.getBalance(ADDRESS);
apps/web/src/wallet/adapters/eth.ts:12:  fetchJson,
apps/web/src/wallet/adapters/eth.ts:73:  const getBalance = async (
apps/web/src/wallet/adapters/eth.ts:82:      const balance = await client.getBalance({ address: getAddress(address) });
apps/web/src/wallet/adapters/eth.ts:116:      raw = await fetchJson(url);
apps/web/src/wallet/adapters/eth.ts:218:    getBalance,
apps/web/src/wallet/adapters/ton.ts:3:  fetchJson,
apps/web/src/wallet/adapters/ton.ts:57:      raw = await fetchJson(baseUrl, {
apps/web/src/wallet/adapters/ton.ts:99:  const getBalance = async (
apps/web/src/wallet/adapters/ton.ts:107:    const result = await rpc('getAddressBalance', { address });
apps/web/src/wallet/adapters/ton.ts:246:    getBalance,
apps/web/src/wallet/adapters/types.test.ts:6:  fetchJson,
apps/web/src/wallet/adapters/types.test.ts:35:    getBalance: async () => balance,
apps/web/src/wallet/adapters/types.test.ts:68:describe('fetchJson', () => {
apps/web/src/wallet/adapters/types.test.ts:74:    await expect(fetchJson('https://example.invalid/x')).resolves.toEqual({ a: 1 });
apps/web/src/wallet/adapters/types.test.ts:82:    await expect(fetchJson('https://example.invalid/x')).rejects.toThrow('HTTP 503');
apps/web/src/wallet/adapters/types.test.ts:96:    await expect(fetchJson('https://example.invalid/x')).rejects.toThrow(
apps/web/src/wallet/adapters/types.test.ts:111:    await expect(fetchJson('https://example.invalid/x', undefined, 5)).rejects.toThrow(
apps/web/src/wallet/adapters/types.test.ts:119:    await expect(fetchJson('https://example.invalid/x')).rejects.toThrow(
apps/web/src/wallet/adapters/types.test.ts:148:    await expect(provider.getBalance('eth' as ChainId, '0x0')).resolves.toEqual({
apps/web/src/wallet/adapters/types.test.ts:157:    await expect(provider.getBalance('eth' as ChainId, '0x0')).rejects.toThrow(
apps/web/src/wallet/wallet-context-balances.test.tsx:84:    getBalance: async () => {

```

| Site | Sends | Secrets? |
|---|---|---|
| `types.ts:104` `fetchJson` | whatever URL/init the caller passes (see below) | No - callers pass public data only |
| `btc.ts:53` | GET `{mempool.space}/v1/blocks/0` (genesis hash check, no address) | No |
| `btc.ts:84` | GET `{mempool.space}/address/{address}` | Public address only |
| `btc.ts:127` | GET `{mempool.space}/address/{address}/txs` | Public address only |
| `btc.ts:212` | GET `{mempool.space}/v1/fees/recommended` | No payload |
| `btc.ts:246` | GET `{mempool.space}/address/{address}/utxo` | Public address only |
| `eth.ts:82` | viem `client.getBalance({ address })` to `https://ethereum-rpc.publicnode.com` | Public address only |
| `eth.ts:116` | GET Blockscout `?module=account&action=txlist&address={address}&page=1&offset={limit}&sort=desc` | Public address only |
| `eth.ts` `getGasPrice` / `getTransactionCount({address})` / `getChainId` | viem RPC, address or nothing | Public address only |
| `trx.ts:48` | GET `{api.trongrid.io}/wallet/getnowblock` (identity check) | No payload |
| `trx.ts:78` | GET `{api.trongrid.io}/v1/accounts/{address}` | Public address only |
| `trx.ts:121` | GET `{api.trongrid.io}/v1/accounts/{address}/transactions?limit=&order_by=block_timestamp,desc` | Public address only |
| `trx.ts:185` | GET `{api.trongrid.io}/wallet/getchainparameters` | No payload |
| `ton.ts:57` | POST JSON-RPC to TonCenter (`https://toncenter.com/api/v2/jsonRPC`), body `{id:1, jsonrpc:'2.0', method, params}` | Params are public only (see below) |
| `ton.ts:85` | `rpc('getMasterchainInfo', {})` | Empty params |
| `ton.ts:107` | `rpc('getAddressBalance', { address })` | Public address only |
| `ton.ts:137` | `rpc('getTransactions', { address, limit })` | Public address + limit |
| `ton.ts:214` | `rpc('runGetMethod', { address, method: 'seqno', stack: [] })` | Public address only |
| All four adapters' `broadcast(signedTx)` | Throws `BROADCAST_DISABLED_MESSAGE` - never sends | N/A (disabled) |

No mnemonic, seed, private key or xprv is ever passed to a request: adapter
function signatures take only `address: string` (plus `limit`), and the
source grep in section 1 finds zero secret-pattern hits in any adapter file.
`send.tsx` in this tree is a disabled stub ("Sending is not implemented",
form disabled, no signing) - send is Fix Lane 3's work on its own branch.

## 3. Persistent storage

```
grep -rn -E "localStorage|sessionStorage" apps/web/src/
```

```
apps/web/src/app/security-headers.ts:16://   displayed receive address and exfiltrate xpubs from localStorage).
apps/web/src/app/theme-toggle.tsx:17:  const storedTheme = window.localStorage.getItem(storageKey)
apps/web/src/app/theme-toggle.tsx:43:    window.localStorage.setItem(storageKey, theme)
apps/web/src/state/wallet-context.tsx:22:// localStorage contains public watch-only data only (xpubs and labels), never secrets.
apps/web/src/state/wallet-context.tsx:92:    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
apps/web/src/state/wallet-context.tsx:440:      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.xpubs));
apps/web/src/screens/mnemonic-backup.test.tsx:70:    localStorage.clear();
apps/web/src/screens/mnemonic-backup.test.tsx:76:    localStorage.clear();
apps/web/src/screens/import-wallet.test.tsx:245:    localStorage.clear();
apps/web/src/screens/import-wallet.test.tsx:251:    localStorage.clear();
apps/web/src/screens/import-wallet.tsx:404:            keys are stored in this browser (localStorage) and stay stored
apps/web/src/screens/wallet-management.tsx:88:        Only extended public keys and TON public addresses are stored (in localStorage). No secrets are stored anywhere in this starter.
apps/web/src/wallet/wallet-context.test.tsx:72:  localStorage.clear();
apps/web/src/wallet/vault.ts:5: * unlock/lock lifecycle as patterns only. The envelope in localStorage holds
apps/web/src/wallet/vault.ts:11: * refs, localStorage or logs. JavaScript strings are immutable, so "zeroing"
apps/web/src/wallet/vault.ts:45:  return globalThis.localStorage;
apps/web/src/wallet/vault.test.ts:26:  const raw = localStorage.getItem(VAULT_STORAGE_KEY);
apps/web/src/wallet/vault.test.ts:41:  localStorage.clear();
apps/web/src/wallet/vault.test.ts:57:    const raw = localStorage.getItem(VAULT_STORAGE_KEY) as string;
apps/web/src/wallet/vault.test.ts:123:    localStorage.setItem(
apps/web/src/wallet/vault.test.ts:134:    localStorage.setItem(
apps/web/src/wallet/vault.test.ts:147:    expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
apps/web/src/wallet/wallet-context-balances.test.tsx:121:  localStorage.clear();

```

### Every storage key (production code)

| Key | Written where | Stores | Secrets? |
|---|---|---|---|
| `bawa-vault` | `wallet/vault.ts:17` (`VAULT_STORAGE_KEY`), `writeEnvelope` | Envelope `{version, kdf:{name:'PBKDF2', hash:'SHA-256', iterations:600000, saltB64}, ivB64, ciphertextB64, profileIds}` - AES-256-GCM ciphertext of the mnemonic under a PBKDF2-derived key. `readEnvelope` rejects any other shape as corrupted. | No - ciphertext only |
| `bawa-watch-only-xpubs` | `state/wallet-context.tsx:23` (`STORAGE_KEY`), `:440` persistence effect | JSON of per-chain `{xpub, label, derivedCount}` - validated public account xpubs (or TON public addresses) + user labels, max 40 chars | No - public keys + labels only |
| `token-ui-theme` | `app/theme-toggle.tsx:6,43` | `'light'` / `'dark'` string | No |

- `sessionStorage`: **zero hits** in `apps/web/src/` - it is never used.
- Test-only `localStorage` uses (`clear()` / `getItem` / `setItem` in
  `*.test.*`) hold only test fixtures and assertions.
- Vault test assertion (checked in source AND run):
  `wallet/vault.test.ts:55-70`, test "stores only an encrypted envelope,
  never plaintext secrets", asserts the raw stored envelope contains
  neither the test mnemonic words (`'abandon'`, `'about'`), nor the test
  password, nor `'correct horse'`, and checks envelope shape (version 1,
  PBKDF2 600k / SHA-256, 16-byte salt, 12-byte IV, string ciphertext).
  Run: `npx vitest run src/wallet/vault.test.ts` under Node 22.23.4 -
  **10 passed, 0 failed**.
- Label caveat (the code's own comment, `state/wallet-context.tsx:15-22`):
  the 40-char label bound keeps a complete 12-word English mnemonic (47
  chars min), xprv (111) or 32-byte hex key (64) from fitting, but it is "a
  bound, not a guarantee" - a shorter complete secret (e.g. 23-char Chinese
  mnemonic, 40-char Z85 key) or a fragment could still fit in a label.
  Mitigations present: watch-only import rejects secret-like input
  (`boundary.ts`), and an over-long stored label is restored as `''` and
  overwritten. No secret was found stored; this is a recorded limitation,
  not a leak.

## 4. Build output

Build (in `apps/web/`):

- First attempt: the nvm-sourcing wrapper expanded `$NVM_DIR` in the wrong
  shell, so nvm was not found and the build ran under the VM default Node
  v24.22.2 - it still succeeded (`tsc --noEmit` + `vite build`,
  "built in 2.98s"). The repo pins Node >=22 <23; to follow the brief
  exactly the build was re-run properly under Node 22.23.4 via a transferred
  script (`/tmp/f-build22.sh`, log `/tmp/f-build22.log`,
  `node --version` = `v22.23.4`): **"built in 1.44s"**,
  `dist/assets/index-CJOXFLgY.js` 3,595.96 kB, `dist/index.html`,
  `dist/wallet-core.wasm` present.
- `node_modules` was copied from the `fix-adapters` worktree (same commit
  `fe6fd76`) instead of `npm ci`; the `@bawa/contracts` symlink resolves
  relatively to this worktree's own `packages/contracts`, so the bundle is
  the same content. `node_modules/` and `dist/` are git-ignored (verified
  with `git check-ignore`) and are not committed.

Dist pattern grep (case-insensitive, JS bundle `dist/assets/index-*.js`):

```
grep -r -o -i -E "mnemonic|seed|privateKey|private_key|xprv|secret" dist/
Mnemonic 16 | PrivateKey 175 | Secret 1 | mnemonic 15 | privateKey 1509
private_key 124 | secret 4 | seed 7 | xprv 2
```

Classification (contexts sampled with 60-80 chars of surrounding text):

- `privateKey` / `private_key` / `PrivateKey` - Trust Wallet Core /
  protobuf / noble-curves library glue: field descriptors
  ("`privateKey: buffer expected`"), `prototype.privateKey`, WalletType
  enum values. Code identifiers, never values.
- `mnemonic` / `Mnemonic` - Wallet Core StoredKey API surface names
  (`decryptMnemonic`, `exportMnemonic`, `Mnemonic.isValid`,
  `createWithMnemonic`) and UI copy. Code, never values.
- `seed` - one noble-curves helper (`{seed:x,...}`) plus UI copy
  ("Never paste recovery words, seeds or private keys").
- `secret` / `Secret` - `getSharedSecret` (ECDH library code) plus UI copy
  ("never holds secrets", "do not enter secrets", "No secrets are stored
  anywhere in this starter").
- `xprv` (2) - the secret-like rejection regex and the UI sentence
  "Private extended keys (xprv/zprv) are rejected."

Test-value absence (checked by a script that reads the values from
`vault.test.ts` and greps without ever printing them,
`/tmp/f-distcheck.py`):

- `OK: test-mnemonic-phrase absent from dist`
- `OK: test-password absent from dist`
- `abandon`: 0 hits in dist JS/CSS/HTML; exactly 1 standalone occurrence
  in `dist/wallet-core.wasm` - the embedded BIP-39 English wordlist string
  table (neighbouring strings are unrelated words, not a phrase).
- `about`: 1 hit in the JS bundle = the `about:` URL scheme in a library
  URL-scheme allow-list, not the mnemonic word.

## 5. Logs

```
grep -rn -E "console\.(log|warn|error|info|debug|trace)" apps/web/src/wallet/ apps/web/src/screens/
```

Result: **empty - 0 hits.** Extended to `apps/web/src/state/`,
`apps/web/src/app/`, `apps/web/src/engine/` (non-test): also **0 hits**.
No secret material is logged anywhere in the new wallet code. Clipboard use
is public-address only (`receive.tsx`, `asset-detail.tsx` copy the receive
address; `qr-scanner.tsx` only uses `getUserMedia`).

## Caveats / open items (not leaks)

1. The 40-char label bound is not a guarantee against short secret
   fragments (see section 3); no such storage was found.
2. `withSigningKey` (`core.ts:278-317`) has no production caller in this
   tree - its only caller is `core.test.ts:178`. Send/signing is Fix Lane
   3's work; `send.tsx` here is a disabled stub.
3. The mnemonic exists in memory in exactly two places: React local state
   in `create-wallet.tsx` / `import-wallet.tsx` (cleared on unmount, error
   and success) and the vault module closure while unlocked (dropped by
   `lock()`). JS strings are immutable, so "zeroing" means dropping every
   reference, as documented in `vault.ts` - no copy is retained after lock.
4. `node_modules` was copied from the sibling worktree rather than freshly
   installed (same commit); the rebuilt bundle was verified, not assumed.

## Verdict (repeated)

**PASS** - At `fe6fd76`, no private keys or mnemonics appear in backend
requests, logs, or persistent plaintext storage. Evidence: 196-hit source
grep fully classified with zero leaks; single `fetchJson` site + viem
client sending public addresses only; three localStorage keys holding an
encrypted envelope, public xpubs/labels, and a theme string, with zero
`sessionStorage` use; production build clean of the test mnemonic phrase
and test password; zero `console.*` calls in the wallet/screens code; the
vault envelope test passes (10/10).
