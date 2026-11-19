"""Lane A perf: apply Sol prompt-4a (staged Generate progress + preload).
Run on muse-vm from the fix-perf-a worktree root: python3 lane/apply-p4a.py
"""
SCREEN = 'apps/web/src/screens/create-wallet.tsx'

with open(SCREEN, encoding='utf-8') as f:
    src = f.read()

old_imp = "import { useWallet } from '../state/wallet-context';"
assert src.count(old_imp) == 1, 'useWallet import not found once'
src = src.replace(
    old_imp,
    "import { loadCore } from '../engine/boundary';\nimport { useWallet } from '../state/wallet-context';",
    1,
)

old_helper_anchor = "const MIN_PASSWORD_LENGTH = 8;"
assert src.count(old_helper_anchor) == 1, 'MIN_PASSWORD anchor not found once'
src = src.replace(
    old_helper_anchor,
    """function yieldFrame(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve(undefined));
    } else {
      setTimeout(() => resolve(undefined), 0);
    }
  });
}

const MIN_PASSWORD_LENGTH = 8;""",
    1,
)

old_state = """  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Clear the mnemonic when the screen unmounts.
  useEffect(() => () => {
    setMnemonic(null);
  }, []);"""
assert src.count(old_state) == 1, 'state+mount effect not found once'
src = src.replace(
    old_state,
    """  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    // Preload the engine while the user types. Failure is fine because
    // handleGenerate loads it on demand.
    void loadCore().catch(() => {});

    // Clear the mnemonic when the screen unmounts.
    return () => {
      setMnemonic(null);
    };
  }, []);""",
    1,
)

old_gen = """    setIsBusy(true);
    try {
      const generated = await createWallet();"""
assert src.count(old_gen) == 1, 'handleGenerate open not found once'
src = src.replace(
    old_gen,
    """    setIsBusy(true);
    try {
      setProgress('Loading wallet engine…');
      await yieldFrame();
      await loadCore();

      setProgress('Generating recovery phrase…');
      await yieldFrame();
      const generated = await createWallet();""",
    1,
)

old_fin = """    } catch {
      setMnemonic(null);
      setError('The wallet could not be generated. Please try again.');
    } finally {
      setIsBusy(false);
    }
  }"""
assert src.count(old_fin) == 1, 'handleGenerate finally not found once'
src = src.replace(
    old_fin,
    """    } catch {
      setMnemonic(null);
      setError('The wallet could not be generated. Please try again.');
    } finally {
      setProgress(null);
      setIsBusy(false);
    }
  }""",
    1,
)

old_btn = """                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? 'Generating…' : 'Generate recovery phrase'}
                </Button>"""
assert src.count(old_btn) == 1, 'step-1 button not found once'
src = src.replace(
    old_btn,
    """                <Button type="submit" className="h-auto whitespace-normal py-3 text-center">
                  {isBusy ? (progress ?? 'Generating…') : 'Generate recovery phrase'}
                </Button>""",
    1,
)

with open(SCREEN, 'w', encoding='utf-8') as f:
    f.write(src)
print('create-wallet.tsx: staged Generate progress + engine preload on mount')
print('OK')
