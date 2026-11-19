"""Lane A perf: apply Sol prompt-3 (createVault leaves vault unlocked).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p3.py
"""
VAULT = 'apps/web/src/wallet/vault.ts'
TEST = 'apps/web/src/wallet/vault.test.ts'

with open(VAULT, encoding='utf-8') as f:
    src = f.read()

old_sig = """): Promise<VaultEnvelope> {"""
assert src.count(old_sig) == 1, 'encryptEnvelope signature not found once'
src = src.replace(old_sig, """): Promise<{ envelope: VaultEnvelope; key: CryptoKey }> {""", 1)

old_ret = """  return {
    version: VAULT_VERSION,
    kdf: {
      name: 'PBKDF2',
      hash: PBKDF2_HASH,
      iterations: PBKDF2_ITERATIONS,
      saltB64: toBase64(salt),
    },
    ivB64: toBase64(iv),
    ciphertextB64: toBase64(new Uint8Array(ciphertext)),
    profileIds: [...profileIds],
  };"""
assert src.count(old_ret) == 1, 'encryptEnvelope return not found once'
src = src.replace(
    old_ret,
    """  return {
    envelope: {
      version: VAULT_VERSION,
      kdf: {
        name: 'PBKDF2',
        hash: PBKDF2_HASH,
        iterations: PBKDF2_ITERATIONS,
        saltB64: toBase64(salt),
      },
      ivB64: toBase64(iv),
      ciphertextB64: toBase64(new Uint8Array(ciphertext)),
      profileIds: [...profileIds],
    },
    key,
  };""",
    1,
)

old_create_sig = """export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
): Promise<void> {"""
assert src.count(old_create_sig) == 1, 'createVault signature not found once'
src = src.replace(
    old_create_sig,
    """export async function createVault(
  mnemonic: string,
  password: string,
  profileIds: string[],
  passphrase = '',
): Promise<void> {""",
    1,
)

old_create_tail = """  const envelope = await encryptEnvelope(mnemonic, password, profileIds);
  writeEnvelope(envelope);
  lock();"""
assert src.count(old_create_tail) == 1, 'createVault tail not found once'
src = src.replace(
    old_create_tail,
    """  const { envelope, key } = await encryptEnvelope(mnemonic, password, profileIds);
  writeEnvelope(envelope);
  unlockedKey = key;
  unlockedMnemonic = mnemonic;
  unlockedPassphrase = passphrase;""",
    1,
)

old_cp = """  const next = await encryptEnvelope(mnemonic, newPassword, envelope.profileIds);"""
assert src.count(old_cp) == 1, 'changePassword encryptEnvelope not found once'
src = src.replace(
    old_cp,
    """  const { envelope: next } = await encryptEnvelope(
    mnemonic,
    newPassword,
    envelope.profileIds,
  );""",
    1,
)
with open(VAULT, 'w', encoding='utf-8') as f:
    f.write(src)
print('vault.ts: createVault leaves unlocked, passphrase param, changePassword adapts')

with open(TEST, encoding='utf-8') as f:
    t = f.read()

old_t1 = """    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(isLocked()).toBe(true);
  });"""
assert t.count(old_t1) == 1, 'test creates-a-vault not found once'
t = t.replace(
    old_t1,
    """    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    expect(hasVault()).toBe(true);
    expect(vaultProfiles()).toEqual(TEST_PROFILES);
    expect(isLocked()).toBe(false);
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });

  it('leaves the vault unlocked with the session passphrase', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES, 'TREZOR');
    expect(isLocked()).toBe(false);
    expect(getSessionPassphrase()).toBe('TREZOR');
    expect(withMnemonic((m) => m)).toBe(TEST_MNEMONIC);
  });""",
    1,
)

old_t2 = """  it('rejects a wrong password with one fixed message and stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(unlock('wrong password')).rejects.toThrow("""
assert t.count(old_t2) == 1, 'test wrong-password not found once'
t = t.replace(
    old_t2,
    """  it('rejects a wrong password with one fixed message and stays locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    await expect(unlock('wrong password')).rejects.toThrow(""",
    1,
)

old_t3 = """  it('fails closed on a tampered ciphertext', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    const envelope = readRawEnvelope();"""
assert t.count(old_t3) == 1, 'test tampered not found once'
t = t.replace(
    old_t3,
    """  it('fails closed on a tampered ciphertext', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    const envelope = readRawEnvelope();""",
    1,
)

old_t4 = """  it('throws when locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow("""
assert t.count(old_t4) == 1, 'test throws-when-locked not found once'
t = t.replace(
    old_t4,
    """  it('throws when locked', async () => {
    await createVault(TEST_MNEMONIC, TEST_PASSWORD, TEST_PROFILES);
    lock();
    await expect(withMnemonicAsync(async () => 'never')).rejects.toThrow(""",
    1,
)
with open(TEST, 'w', encoding='utf-8') as f:
    f.write(t)
print('vault.test.ts: 4 tests updated + 1 new test')
print('OK')
