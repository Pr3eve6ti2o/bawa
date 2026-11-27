// Two import modes. Mode A (recovery phrase) restores a vault wallet: the
// phrase lives in this screen's local state only until it is validated and
// derived, then the input is cleared immediately, and on unmount. It is never
// stored, logged or passed to the watch-only path. Mode B (watch-only public
// key) keeps the existing behaviour exactly: a mnemonic, seed or private key
// must never be pasted there — secret-like input is rejected and cleared at
// once. Watch-only accounts can never sign.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import type { WatchOnlyWallet } from '@bawa/contracts';
import { validateWatchOnlyImport, type ChainId } from '../engine/boundary';
import { detectAddressFormat } from '../wallet/address-detection';
import { useWallet } from '../state/wallet-context';
import {
  deriveAddresses,
  restoreWallet,
  type WalletAddresses,
} from '../wallet/core';
import { accountName, createVault, hasVault } from '../wallet/vault';
import { setPassphraseUsed } from '../wallet/passphrase';
import {
  IMPORT_PHRASE_HINT,
  splitMnemonicAndPassphrase,
} from '../wallet/bip39-validation';
import { chainConfig, profileFor, SUPPORTED_CHAINS } from '../wallet/chains';
import { ChainSearchSelect, readLastUsedChain } from './chain-search-select';
import { WalletReadyActions } from './wallet-ready-actions';
import { Alert, AlertDescription } from '../ui/components/alert';
import { Tabs, TabsList, TabsTrigger } from '../ui/components/tabs';
import { Badge } from '../ui/components/badge';
import { Button } from '../ui/components/button';
import { CopyButton } from '../ui/components/copy-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/components/card';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { toast } from '../ui/components/toast';
import { wordlist } from '@scure/bip39/wordlists/english.js';

// Unique-prefix completion for the recovery-phrase input (repo-study
// Phase 3, item 31): Tab completes the word being typed when exactly
// one BIP-39 word has that prefix. Ambiguous prefixes and already
// complete words are left alone, so Tab keeps its normal focus behaviour
// when nothing expands.
export function expandUniquePrefix(value: string): string {
  const start = value.lastIndexOf(' ') + 1;
  const prefix = value.slice(start).toLowerCase();

  if (!prefix || wordlist.includes(prefix)) return value;

  const matches = wordlist.filter((word) => word.startsWith(prefix));
  return matches.length === 1
    ? `${value.slice(0, start)}${matches[0]} `
    : value;
}

// Watch-only chain auto-detection (UX-major Lane 7 merge, 2026-11-26):
// the format table lives once now, in wallet/address-detection.ts
// (Lane 3), and this function is a thin translation of its result
// into the single chain the watch-only picker needs. Behaviour is
// preserved exactly — the differential test in
// wallet/address-detection-differential.test.ts pins it:
//   - a 0x address is the same address on all 60 EVM chains, so the
//     picker keeps its legacy reading of 'eth';
//   - bare base58 (32-44 chars) is deliberately NOT detected as
//     Solana here: too many chains share the shape, so the picker
//     stays where the user put it for those;
//   - 0x + 64 hex keeps its legacy reading of 'aptos' (in the Send
//     recipient field the same shape is warned about as a possible
//     private key — context-dependent, both readings asserted).
// Extended keys (xpub/zpub/Ltub/dpub/...) never match: they carry no
// address prefix to detect from.
export function detectWatchOnlyChain(value: string): ChainId | null {
  const input = value.trim();
  if (input === '') return null;
  if (/^0x[0-9a-fA-F]{64}$/.test(input)) return 'aptos';
  const format = detectAddressFormat(input);
  if (format === null) return null;
  if (format.kind === 'evm') return 'eth';
  if (format.kind === 'secret') return null;
  if (format.chain === 'sol') return null;
  return format.chain;
}

// Merge lane (2026-11-24): the picker used to hardcode the original 22
// chains while validation, derivation and labels already covered all 87
// registry chains — the picker is now the full SUPPORTED_CHAINS list.
const chains: ChainId[] = [...SUPPORTED_CHAINS];
// Token gaps, item 6 + item 8: the picker used to list only the first
// four chains even though validation (validateWatchOnlyImport), address
// derivation (deriveAddresses, incl. the single-address SOL/TON path)
// and the input labels below already cover all 87 registry chains. A
// Solana or Dogecoin address could not be watched at all.

type ImportInputConfig = {
  label: string;
  placeholder: string;
};

const inputConfigByChain: Record<ChainId, ImportInputConfig> = {
  // Lane B (Finish the Product): every chain accepts a plain public
  // address as well as its extended key. An address fans out to every
  // chain in its family (one 0x address covers all 59 0x EVM chains —
  // Lane 80-APP; Ronin keeps its ronin: prefix and Filecoin its f1
  // form, so neither joins the 0x family). The seven Ed25519 chains
  // accept an address only: they have no extended public key.
  btc: { label: 'Bitcoin address or account public key (xpub / zpub)', placeholder: 'bc1… or xpub…' },
  eth: { label: 'Ethereum address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  trx: { label: 'TRON address (T…) or account public key (xpub)', placeholder: 'T… or xpub…' },
  ton: { label: 'TON public address', placeholder: 'UQ… or 0:…' },
  sol: { label: 'Solana public address', placeholder: 'GjJy…' },
  bsc: { label: 'BNB Smart Chain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  matic: { label: 'Polygon address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  arb: { label: 'Arbitrum One address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  op: { label: 'OP Mainnet address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  base: { label: 'Base address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  avax: { label: 'Avalanche C-Chain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  gnosis: { label: 'Gnosis address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  celo: { label: 'Celo address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  linea: { label: 'Linea address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  mantle: { label: 'Mantle address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  scroll: { label: 'Scroll address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  opbnb: { label: 'opBNB address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  metis: { label: 'Metis address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  aurora: { label: 'Aurora address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  fantom: { label: 'Fantom address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  // Lane A: both LTC serialisations are accepted (Ltub, what this
  // wallet exports, and zpub, what Trust Wallet lists as Litecoin's
  // segwit xpub) — same key.
  ltc: { label: 'Account public key (Ltub or zpub)', placeholder: 'Ltub… or zpub…' },
  // Lane C: both DOGE serialisations are accepted (dpub, what Trust
  // Wallet Core emits, and dgub, what bip_utils emits) — same key.
  doge: { label: 'Dogecoin address or account public key (dpub or dgub)', placeholder: 'D… or dpub…' },
  zksync: { label: 'ZKsync Era address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  cronos: { label: 'Cronos address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  kava: { label: 'Kava address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  filecoin: { label: 'Filecoin address (f1…) or account public key (xpub)', placeholder: 'f1… or xpub…' },
  zora: { label: 'Zora address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  mode: { label: 'Mode address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  fraxtal: { label: 'Fraxtal address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  berachain: { label: 'Berachain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  sei: { label: 'Sei address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  arbnova: { label: 'Arbitrum Nova address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  worldchain: { label: 'World Chain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  manta: { label: 'Manta Pacific address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  unichain: { label: 'Unichain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  ink: { label: 'Ink address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  abstract: { label: 'Abstract address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  soneium: { label: 'Soneium address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  apechain: { label: 'ApeChain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  sonic: { label: 'Sonic address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  hyperevm: { label: 'HyperEVM address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  monad: { label: 'Monad address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  ronin: { label: 'Ronin address (ronin:…) or account public key (xpub)', placeholder: 'ronin:… or xpub…' },
  immutable: { label: 'Immutable zkEVM address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  fuse: { label: 'Fuse address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  velas: { label: 'Velas address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  syscoin: { label: 'Syscoin address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  theta: { label: 'Theta address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  iotex: { label: 'IoTeX address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  xlayer: { label: 'X Layer address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  boba: { label: 'Boba Network address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  taiko: { label: 'Taiko address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  astar: { label: 'Astar address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  telos: { label: 'Telos address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  conflux: { label: 'Conflux eSpace address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  core: { label: 'Core address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  songbird: { label: 'Songbird address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  rootstock: { label: 'Rootstock address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  pulsechain: { label: 'PulseChain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  xdc: { label: 'XDC Network address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  chiliz: { label: 'Chiliz address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  etc: { label: 'Ethereum Classic address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  flare: { label: 'Flare address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  zetachain: { label: 'ZetaChain address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  hemi: { label: 'Hemi address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  bob: { label: 'BOB address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  flowevm: { label: 'Flow EVM address (0x…) or account public key (xpub)', placeholder: '0x… or xpub…' },
  cosmos: { label: 'Cosmos Hub address (cosmos1…) or account public key (xpub)', placeholder: 'cosmos1… or xpub…' },
  osmosis: { label: 'Osmosis address (osmo1…) or account public key (xpub)', placeholder: 'osmo1… or xpub…' },
  xrp: { label: 'XRP Ledger address (r…) or account public key (xpub)', placeholder: 'r… or xpub…' },
  stellar: { label: 'Stellar public address', placeholder: 'GB3J…' },
  polkadot: { label: 'Polkadot public address', placeholder: '14E9…' },
  near: { label: 'NEAR Protocol public address', placeholder: '5510…' },
  aptos: { label: 'Aptos public address', placeholder: '0xeb…' },
  tezos: { label: 'Tezos public address', placeholder: 'tz1…' },
  algorand: { label: 'Algorand public address', placeholder: 'EP2D…' },
  hedera: { label: 'Hedera public address', placeholder: '0.0.…' },
  injective: { label: 'Injective address (inj1…) or account public key (xpub)', placeholder: 'inj1… or xpub…' },
  celestia: { label: 'Celestia address (celestia1…) or account public key (xpub)', placeholder: 'celestia1… or xpub…' },
  dydx: { label: 'dYdX address (dydx1…) or account public key (xpub)', placeholder: 'dydx1… or xpub…' },
  seicosmos: { label: 'Sei (Cosmos) address (sei1…) or account public key (xpub)', placeholder: 'sei1… or xpub…' },
  axelar: { label: 'Axelar address (axelar1…) or account public key (xpub)', placeholder: 'axelar1… or xpub…' },
  noble: { label: 'Noble address (noble1…) or account public key (xpub)', placeholder: 'noble1… or xpub…' },
  juno: { label: 'Juno address (juno1…) or account public key (xpub)', placeholder: 'juno1… or xpub…' },
  // Lane B: no xpub for any of the three — Cardano is Ed25519, Kaspa
  // has no Wallet Core coin, Starknet keys are ground from a private
  // key — so the input is a plain public address only.
  cardano: { label: 'Cardano address (addr1…)', placeholder: 'addr1…' },
  kaspa: { label: 'Kaspa address (kaspa:…)', placeholder: 'kaspa:…' },
  starknet: { label: 'Starknet address (0x…)', placeholder: '0x…' },
};

const MIN_PASSWORD_LENGTH = 8;
const DISPLAY_ORDER = ['eth', 'btc', 'trx', 'ton'] as const;
const CHAIN_LABELS: Record<string, string> = {
  eth: 'Ethereum',
  btc: 'Bitcoin',
  trx: 'TRON',
  ton: 'TON',
};

type ImportMode = 'phrase' | 'watch-only';
type PhraseStep = 'enter' | 'preview' | 'saved' | 'same' | 'different';

/**
 * Derived-address list shared by the four phrase-step cards (same
 * phrase, different phrase, preview, restored). The preview and
 * restored cards offer a copy button per address; the comparison
 * cards do not.
 */
function DerivedAddressesList({
  derived,
  copyable,
}: {
  derived: WalletAddresses;
  copyable: boolean;
}) {
  return (
    <ul className="space-y-3">
      {DISPLAY_ORDER.map((chainId) => (
        <li key={chainId} className="space-y-1">
          {copyable ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-base font-semibold">{CHAIN_LABELS[chainId]}</div>
              <CopyButton
                value={derived[chainId]}
                label={`Copy ${CHAIN_LABELS[chainId]} address`}
              />
            </div>
          ) : (
            <div className="text-base font-semibold">{CHAIN_LABELS[chainId]}</div>
          )}
          <code className="block break-all rounded-md bg-muted p-3 text-sm">
            {derived[chainId]}
          </code>
        </li>
      ))}
    </ul>
  );
}

export function ImportWalletScreen() {
  const {
    xpubs,
    addXpub,
    addWatchOnlyAddress,
    refreshVaultAccounts,
    resetReceiveRotation = () => {},
    vaultAddresses,
    vaultAccounts,
    vaultPassphraseNeeded,
    createVaultAccounts,
    selectVaultAccount,
  } = useWallet();
  const imported = chains
    .map((id) => xpubs[id])
    .filter((wallet): wallet is WatchOnlyWallet => wallet !== null);
  // Lane 5: Welcome's tertiary "Watch a wallet" links here with
  // ?mode=watch-only, so a user who only wants to look lands straight
  // on the Watch-only tab instead of having to find it.
  const location = useLocation();
  const [mode, setMode] = useState<ImportMode>(() =>
    new URLSearchParams(location.search).get('mode') === 'watch-only'
      ? 'watch-only'
      : 'phrase',
  );

  // Mode B (watch-only) state — existing behaviour, unchanged.
  // P1 (Lane S1): the chain starts at the last-used chain.
  const [chain, setChain] = useState<ChainId>(() => readLastUsedChain(chains) ?? 'btc');
  const [xpub, setXpub] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Lane 5: the chain detected from what the user pasted, if the
  // value is unambiguous (see detectWatchOnlyChain). Shown under the
  // input as "Detected: Ethereum" — the picker follows the paste, so
  // a valid address for another chain is never rejected for being
  // pasted under the wrong chain.
  const [detectedChain, setDetectedChain] = useState<ChainId | null>(null);
  // Lane B: the result of the last successful watch-only add — how many
  // chains an address fanned out to, and how many were already watched.
  const [notice, setNotice] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Mode A (recovery phrase) state.
  const [phrase, setPhrase] = useState('');
  const [phraseStep, setPhraseStep] = useState<PhraseStep>('enter');
  const [normalizedMnemonic, setNormalizedMnemonic] = useState<string | null>(null);
  const [derived, setDerived] = useState<WalletAddresses | null>(null);
  const [phraseError, setPhraseError] = useState<string | null>(null);
  const [vaultPassword, setVaultPassword] = useState('');
  const [vaultPasswordConfirm, setVaultPasswordConfirm] = useState('');
  // The recovery passphrase (extra word) that came with the pasted
  // phrase, if any — from the split, never typed separately. It is never
  // stored; it shapes the previewed addresses below.
  const [splitPassphrase, setSplitPassphrase] = useState('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [vaultExists, setVaultExists] = useState(false);
  const [addedAccount, setAddedAccount] = useState<number | null>(null);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  // True when a vault exists but its addresses are not in memory (it is
  // locked), so a pasted phrase cannot be compared with it yet.
  const [compareUnavailable, setCompareUnavailable] = useState(false);

  // Clear the phrase when the screen unmounts.
  useEffect(() => () => {
    setPhrase('');
    setSplitPassphrase('');
    setNormalizedMnemonic(null);
  }, []);

  useEffect(() => {
    setVaultExists(hasVault());
  }, [mode]);

  async function handlePhraseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isRestoring) return;
    setPhraseError(null);
    setAddedAccount(null);
    setCompareUnavailable(false);
    // One field takes every form: 12/15/18/21/24 words, or more words
    // where the rest is the recovery passphrase (the 25-word form).
    // The input is cleared immediately: a rejected phrase must not linger.
    const pasted = phrase;
    setPhrase('');
    let split: { mnemonic: string; passphrase: string };
    try {
      split = splitMnemonicAndPassphrase(pasted);
    } catch (cause) {
      setPhraseError(cause instanceof Error ? cause.message : IMPORT_PHRASE_HINT);
      return;
    }
    setIsRestoring(true);
    try {
      const restored = await restoreWallet(split.mnemonic);
      const addresses = await deriveAddresses(restored, split.passphrase);
      setNormalizedMnemonic(restored);
      setSplitPassphrase(split.passphrase);
      setDerived(addresses);
      // Lane C, item 6: a vault already exists. The old code blocked
      // here and told the user to delete it — even for the SAME phrase.
      // Instead, compare the derived addresses with the vault's: the
      // same phrase offers a new account from it; a different phrase
      // still needs a vault replace (one vault per phrase).
      if (hasVault()) {
        const currentEth = vaultAddresses.eth[0];
        const currentBtc = vaultAddresses.btc[0];
        if (currentEth === undefined || currentBtc === undefined) {
          // The vault is locked, so its addresses are not in memory
          // and nothing can be compared yet.
          setCompareUnavailable(true);
          setPhraseStep('different');
        } else if (
          addresses.eth === currentEth &&
          addresses.btc === currentBtc
        ) {
          setPhraseStep('same');
        } else {
          setPhraseStep('different');
        }
        return;
      }
      setPhraseStep('preview');
    } catch {
      setNormalizedMnemonic(null);
      setDerived(null);
      setSplitPassphrase('');
      setPhraseError(
        'That recovery phrase is not valid. Check every word and try again.',
      );
    } finally {
      setIsRestoring(false);
    }
  }

  // Lane C, item 6: the pasted phrase is the same as the vault's.
  // Add a new account from it (Account 2, Account 3, …) — no deletion,
  // no replacement. Blocked while the vault's recovery passphrase is
  // unknown to the session: a new account derived without it would get
  // the wrong addresses.
  async function handleAddSamePhraseAccount() {
    if (isAddingAccount) return;
    setPhraseError(null);
    setIsAddingAccount(true);
    try {
      const added = await createVaultAccounts(1);
      const next = added[0];
      if (next === undefined) throw new Error('No account was created.');
      await selectVaultAccount(next);
      setAddedAccount(next);
    } catch (cause) {
      setPhraseError(
        cause instanceof Error
          ? cause.message
          : 'The account could not be added. Please try again.',
      );
    } finally {
      setIsAddingAccount(false);
    }
  }

  async function handleSaveSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving || normalizedMnemonic === null) return;
    setPhraseError(null);
    if (vaultPassword.length < MIN_PASSWORD_LENGTH) {
      setPhraseError(`Vault password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (vaultPassword !== vaultPasswordConfirm) {
      setPhraseError('Passwords do not match.');
      return;
    }
    setIsSaving(true);
    try {
      const profileIds = [...new Set(SUPPORTED_CHAINS.map((chainId) => profileFor(chainId)))];
      const mnemonic = normalizedMnemonic;
      const passphrase = splitPassphrase;
      // Merge 1 (Lane B): an imported mnemonic is recorded as
      // 'imported', not 'created' — createVault's default provenance is
      // 'created', which is only correct for the create-wallet flow.
      await createVault(mnemonic, vaultPassword, profileIds, passphrase, {
        source: 'imported',
        isTesting: false,
      });
      // A new phrase starts HD receive rotation at index 0.
      resetReceiveRotation();
      setNormalizedMnemonic(null);
      setVaultPassword('');
      setVaultPasswordConfirm('');
      setPassphraseUsed(passphrase.length > 0);
      setSplitPassphrase('');
      await refreshVaultAccounts();
      setPhraseStep('saved');
    } catch {
      setNormalizedMnemonic(null);
      setPhraseError(
        'The wallet could not be saved. Please try again.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  // Lane 5: detect the chain from the pasted value as it is typed,
  // and let the picker follow an unambiguous paste (see
  // detectWatchOnlyChain). The input is never cleared here — only a
  // rejected submit clears it, as before.
  function handleWatchOnlyInput(value: string): void {
    setXpub(value);
    setError(null);
    setNotice(null);
    const detected = detectWatchOnlyChain(value);
    setDetectedChain(detected);
    if (detected !== null && detected !== chain) setChain(detected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAdding) return;

    const publicKey = xpub.trim();
    // T41: clear the draft immediately. A pasted mnemonic or private key
    // must not linger in the field (and in React state / the DOM) after
    // a rejected submission; the old code returned on validation failure
    // with the input still populated.
    setXpub('');
    // T43 r2b Fix (a): validate before setting the adding state, so a
    // rejected value reports its specific error and returns early.
    const validation = await validateWatchOnlyImport(chain, publicKey);
    if (!validation.ok) {
      // Clear again inside the failure block (already cleared above by
      // the T41 step): the rejection path must clear before reporting.
      setXpub('');
      // Lane 5: a value that is a valid address for ANOTHER chain was
      // the commonest rejection (a 0x address pasted under Bitcoin).
      // Name the chain it looks like instead of reporting the raw
      // validator jargon ("invalid base58 character in extended key").
      const detected = detectWatchOnlyChain(publicKey);
      setError(
        detected !== null && detected !== chain
          ? `That looks like a ${chainConfig(detected).displayName} address, not a ${chainConfig(chain).displayName} one. The input was cleared — pick ${chainConfig(detected).displayName} above and try again. Never paste a mnemonic or private key here.`
          : `${validation.message || 'Invalid public key or address.'} The input was cleared; never paste a mnemonic, seed or private key here.`,
      );
      return;
    }

    setError(null);
    setNotice(null);
    setIsAdding(true);
    try {
      const validation = await validateWatchOnlyImport(chain, publicKey);
      if (!validation.ok) {
        // Secret-free error: never echo the rejected input back.
        setError(`Invalid public key or address. The input was cleared; never paste a mnemonic, seed or private key here.`);
        return;
      }
      // Lane B: a plain address fans out to every chain in its family
      // (one 0x address covers all 59 EVM chains); an extended key
      // watches one chain, as before.
      if (validation.kind === 'address') {
        const { added, skipped } = await addWatchOnlyAddress(chain, publicKey, label.trim());
        if (added.length === 0) {
          setNotice(
            skipped.length === 1
              ? 'That address is already watched on this chain. Nothing changed.'
              : `That address is already watched on all ${skipped.length} chains in its family. Nothing changed.`,
          );
        } else {
          setNotice(
            `Watching this address on ${added.length} ${added.length === 1 ? 'chain' : 'chains'}` +
              (skipped.length > 0
                ? ` (${skipped.length} ${skipped.length === 1 ? 'chain' : 'chains'} already watched — kept as they were).`
                : '.'),
          );
        }
      } else {
        await addXpub(chain, publicKey, label.trim());
      }
      toast.success('Watch-only wallet added.');
      setLabel('');
    } catch {
      setError('The wallet could not be added. Please try again.');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    // Follow-up (desktop-layout-v2): the screen was wrapped in a centered 720px column,
    // which reads as a phone column on a 1440px main. The intro now
    // sits left (5 of 12) and the mode-specific form right (7 of 12)
    // at lg. Below lg the same blocks stack in one column in the same
    // order (space-y-6, no bare grid class), so the mobile layout is
    // untouched.
    <div className="space-y-6 lg:grid lg:grid-cols-[5fr_7fr] lg:gap-6 lg:items-start lg:space-y-0">
      <Card radius="xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Import a wallet</CardTitle>
            <Badge variant="secondary">Watch-only can never sign or spend</Badge>
          </div>
          <CardDescription>
            Restore a wallet from its recovery phrase, or track a wallet
            watch-only from its public key. A watch-only account can never
            sign or spend.
          </CardDescription>
        </CardHeader>
        <CardContent>
           <Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
             <TabsList aria-label="Import mode">
               <TabsTrigger value="phrase">Restore full wallet</TabsTrigger>
               <TabsTrigger value="watch-only">Watch-only</TabsTrigger>
             </TabsList>
           </Tabs>
        </CardContent>
      </Card>

      {/* Right column at lg: every mode-specific block lives in this
          one wrapper so the intro keeps the left column to itself.
          The wrapper is a plain div below lg, so the mobile order and
          spacing are unchanged. */}
      <div className="space-y-6">
      {mode === 'phrase' && vaultExists && (
        <Alert>
          <AlertDescription>
            You already have a wallet on this device. If the phrase below
            is the same as your current wallet&apos;s phrase, you can add a
            new account from it instead of replacing anything. A different
            phrase would replace the vault.
          </AlertDescription>
        </Alert>
      )}

      {mode === 'phrase' && phraseStep === 'enter' && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>Restore from a recovery phrase</CardTitle>
            <CardDescription>
              Enter the words of the wallet you want to restore, in order.
              They are used once to derive your addresses, then cleared.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" noValidate onSubmit={(event) => void handlePhraseSubmit(event)}>
              <fieldset disabled={isRestoring} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-phrase">Recovery phrase</Label>
                  <Input
                    id="recovery-phrase"
                    type="text"
                    className="font-mono"
                    value={phrase}
                    onChange={(event) => {
                      setPhrase(event.target.value);
                      setPhraseError(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Tab' || event.shiftKey) return;
                      const expanded = expandUniquePrefix(phrase);
                      if (expanded !== phrase) {
                        event.preventDefault();
                        setPhrase(expanded);
                      }
                    }}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="12 to 24 words, in order"
                    required
                  />
                  {/* Lane 5: live word count (DESIGN-SYSTEM §6). The
                      old placeholder carried the whole instruction and
                      clipped at 390 px; the count is what the user
                      needs while typing. */}
                  {phrase.trim() !== '' && (
                    <p className="text-sm text-muted-foreground">
                      {(() => {
                        const count = phrase.trim().split(/\s+/).length;
                        return [12, 15, 18, 21, 24].includes(count)
                          ? `${count} words — ready to restore.`
                          : `${count} ${count === 1 ? 'word' : 'words'} — a phrase has 12, 15, 18, 21 or 24 words.`;
                      })()}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Only enter a recovery phrase on this screen, on this
                    device. Never paste it into any other app or website.
                    Press Tab to complete the word you are typing when it
                    has only one possible completion. If your wallet uses an
                    extra word (a 25th word), paste all 25 words here —
                    the extra word is your recovery passphrase, used to
                    derive the addresses below. It is never stored.
                  </p>
                </div>
                {phraseError && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{phraseError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" size="md" disabled={isRestoring}>
                  {isRestoring ? 'Restoring…' : 'Restore wallet'}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && phraseStep === 'same' && derived !== null && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>This is the same recovery phrase</CardTitle>
            <CardDescription>
              The addresses match your current wallet. You can add a new
              account from this phrase — there is no need to delete
              anything.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DerivedAddressesList derived={derived} copyable={false} />
            {addedAccount !== null ? (
              <>
                <p role="status" className="text-base leading-6">
                  {accountName(addedAccount)} added. It is a new account
                  from the same recovery phrase, with its own addresses.
                </p>
                <Button asChild size="wrap">
                  <Link to="/wallets">See your accounts</Link>
                </Button>
              </>
            ) : (
              <>
                {vaultPassphraseNeeded && splitPassphrase !== '' && (
                  <Alert>
                    <AlertDescription>
                      This wallet uses a recovery passphrase, and this
                      browser does not know it right now. Unlock your
                      wallet with your recovery passphrase first, then add
                      the account — adding it now would derive the wrong
                      addresses.
                    </AlertDescription>
                  </Alert>
                )}
                <Button
                  type="button"
                  disabled={isAddingAccount || (vaultPassphraseNeeded && splitPassphrase !== '')}
                  onClick={() => void handleAddSamePhraseAccount()}
                  size="wrap"
                >
                  {isAddingAccount
                    ? 'Adding…'
                    : `Add as ${accountName(vaultAccounts.length === 0 ? 0 : Math.max(...vaultAccounts) + 1)}`}
                </Button>
                {vaultPassphraseNeeded && splitPassphrase !== '' && (
                  <Button asChild variant="secondary" size="wrap">
                    <Link to="/lock">Unlock with your recovery passphrase</Link>
                  </Button>
                )}
              </>
            )}
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPhraseStep('enter');
                setDerived(null);
                setNormalizedMnemonic(null);
                setSplitPassphrase('');
                setAddedAccount(null);
              }}
            >
              Back
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && phraseStep === 'different' && derived !== null && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>
              {compareUnavailable
                ? 'Your wallet is locked'
                : 'This is a different recovery phrase'}
            </CardTitle>
            <CardDescription>
              {compareUnavailable
                ? 'Your wallet is locked, so this phrase could not be compared with it yet.'
                : 'The addresses do not match your current wallet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DerivedAddressesList derived={derived} copyable={false} />
            {compareUnavailable ? (
              <p className="text-base leading-6">
                Unlock your wallet first, then restore this phrase again to
                compare it. To use a different phrase instead, delete the
                existing vault from security settings — make sure you have
                its recovery phrase written down first.
              </p>
            ) : (
              <p className="text-base leading-6">
                To use this phrase, delete the existing vault from security
                settings first. Make sure you have its recovery phrase
                written down — deleting a vault without its phrase loses
                the wallet. Or keep your current wallet and add another
                account from it on the Wallets screen.
              </p>
            )}
            <div className="flex flex-col gap-3">
              {compareUnavailable ? (
                <Button asChild size="wrap">
                  <Link to="/lock">Unlock your wallet</Link>
                </Button>
              ) : (
                <Button asChild size="wrap">
                  <Link to="/wallets">Add an account from your current phrase</Link>
                </Button>
              )}
              <Button asChild variant="secondary" size="wrap">
                <Link to="/security">Go to security settings</Link>
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setPhraseStep('enter');
                  setDerived(null);
                  setNormalizedMnemonic(null);
                  setSplitPassphrase('');
                  setCompareUnavailable(false);
                }}
              >
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && !vaultExists && phraseStep === 'preview' && derived !== null && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>Check the restored addresses</CardTitle>
            <CardDescription>
              These are the account addresses derived from your recovery
              phrase, Ethereum first. If they are not the addresses you
              expect, stop — the phrase or the recovery profile is wrong.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {splitPassphrase !== '' && (
              <Alert>
                <AlertDescription>
                  An extra word was used as your recovery passphrase to
                  derive these addresses. It is never stored — you will
                  need it again if you restore this wallet elsewhere.
                </AlertDescription>
              </Alert>
            )}
            <DerivedAddressesList derived={derived} copyable />
             <Button
               type="button"
               variant="secondary"
               onClick={() => {
                 setPhraseStep('enter');
                 setDerived(null);
                 setNormalizedMnemonic(null);
                 setSplitPassphrase('');
               }}
             >
               Edit recovery phrase
             </Button>
             <form className="space-y-4" noValidate onSubmit={(event) => void handleSaveSubmit(event)}>
              <fieldset disabled={isSaving} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="import-vault-password">Vault password</Label>
                  <Input
                    id="import-vault-password"
                    type="password"
                    autoComplete="new-password"
                    value={vaultPassword}
                    onChange={(event) => setVaultPassword(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-vault-password-confirm">Repeat vault password</Label>
                  <Input
                    id="import-vault-password-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={vaultPasswordConfirm}
                    onChange={(event) => setVaultPasswordConfirm(event.target.value)}
                  />
                </div>
                {phraseError && (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{phraseError}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" size="wrap">
                  {isSaving ? 'Saving…' : 'Save to vault'}
                </Button>
              </fieldset>
            </form>
          </CardContent>
        </Card>
      )}

      {mode === 'phrase' && !vaultExists && phraseStep === 'saved' && derived !== null && (
        <Card radius="xl">
          <CardHeader>
            <CardTitle>Wallet restored</CardTitle>
            <CardDescription>
              Your recovery phrase is stored encrypted in this browser&apos;s
              vault. Your phrase was cleared from this screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <DerivedAddressesList derived={derived} copyable />
            <WalletReadyActions />
          </CardContent>
        </Card>
      )}

      {mode === 'watch-only' && (
        <>
          {/* Lane 5: the form comes first. The two warning paragraphs
              used to sit above it, so the chain picker, address input
              and Add button were all below the fold on a phone. The
              warnings are unchanged — they now live in a disclosure
              below the imported list, where they are one tap away. */}
          <form
            className="space-y-4"
            noValidate
            aria-busy={isAdding}
            onSubmit={(event) => void handleSubmit(event)}
          >
            {/* UI/UX Round 2, item 3: the chain picker was one horizontal
                row of 22 pills that slid sideways and cut the later
                chains off past the edge. It is now a search bar: click
                it and the full list opens, typing filters it, and the
                chains picked before stay in a Recent row below it. */}
            <ChainSearchSelect
              chains={chains}
              value={chain}
              onChange={setChain}
              id="watch-only-chain-search"
              disabled={isAdding}
            />

            <div className="space-y-2">
              <Label htmlFor="wallet-xpub">{inputConfigByChain[chain].label}</Label>
              <Input
                id="wallet-xpub" name="xpub" type="text"
                className="font-mono"
                value={xpub}
                onChange={(event) => handleWatchOnlyInput(event.target.value)}
                autoComplete="off" autoCapitalize="none" spellCheck={false}
                placeholder={inputConfigByChain[chain].placeholder} required disabled={isAdding}
                aria-invalid={error !== null}
                aria-describedby={error ? 'watch-only-notice import-error' : 'watch-only-notice'}
              />
              {/* Lane 5: the detected chain, shown explicitly
                  (DESIGN-SYSTEM §6). The picker follows an
                  unambiguous paste, so this line confirms what
                  happened instead of leaving the user to guess. */}
              {detectedChain !== null && (
                <p className="text-base font-medium text-ink">
                  Detected: {chainConfig(detectedChain).displayName}
                  {detectedChain === 'eth'
                    ? ' — watches all 59 EVM chains.'
                    : '.'}
                </p>
              )}
              {chain === 'ton' && (
                <p className="text-sm text-muted-foreground">
                  Single public address. No child addresses are derived: the TON path is fully hardened.
                  Watch-only only — this starter cannot send or withdraw TON.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-label">Label (optional)</Label>
              <Input
                id="wallet-label" name="label" type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="e.g. Savings" autoComplete="off" disabled={isAdding}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">Labels are stored in plain text in this browser. Do not enter secrets.</p>
            </div>

            {error && (
              <Alert id="import-error" variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {notice && (
              <p role="status" className="text-base leading-6">
                {notice}
              </p>
            )}
            <Button type="submit" size="md" disabled={isAdding}>
              {isAdding ? 'Adding…' : 'Add'}
            </Button>
          </form>

          <section aria-labelledby="imported-wallets" className="space-y-3">
            <h2 id="imported-wallets" className="font-semibold">Imported wallets</h2>
            {imported.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallets imported yet.</p>
            ) : (
              <ul className="space-y-2">
                {(() => {
                  // Lane B: one address import fans out to a whole family
                  // (16 rows for one 0x address). Group by the stored
                  // value so one import is one row with all its chain
                  // badges, instead of sixteen near-identical rows.
                  const groups = new Map<string, WatchOnlyWallet[]>();
                  for (const wallet of imported) {
                    const list = groups.get(wallet.xpub) ?? [];
                    list.push(wallet);
                    groups.set(wallet.xpub, list);
                  }
                  return [...groups.entries()].map(([value, wallets]) => (
                    <li key={value} className="space-y-2 rounded-xl border bg-card p-4 text-foreground">
                      <div className="flex flex-wrap items-center gap-2">
                        {wallets.map((wallet) => (
                          <Badge key={wallet.chain} variant="secondary">{wallet.chain.toUpperCase()}</Badge>
                        ))}
                        {' '}
                        <span>{wallets[0]?.label || 'Unlabelled wallet'}</span>
                      </div>
                      <code className="block break-all text-sm">
                        {`${value.slice(0, 12)}…${value.slice(-8)}`}
                      </code>
                    </li>
                  ));
                })()}
              </ul>
            )}
          </section>

          {/* Lane 5: the watch-only warnings, moved below the form
              (they used to bury it). Same words, one tap away. The
              notice paragraph keeps its id: the address input above
              references it with aria-describedby. */}
          <details className="rounded-bawa border-2 border-ink bg-paper p-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink">
              What watch-only can and cannot do
            </summary>
            <div className="mt-3 space-y-3">
              <Alert>
                <AlertDescription>
                  Watch-only accounts cannot sign transactions. A public
                  address watches every chain it belongs to — one 0x
                  address covers all 59 EVM chains. An extended public
                  key watches one chain.
                </AlertDescription>
              </Alert>
              <p id="watch-only-notice" className="text-sm leading-5 text-muted-foreground">
                Only extended PUBLIC keys or public addresses are accepted. Private extended keys (xprv/zprv)
                are rejected. Import the account-level key (depth 3, account 0) for the selected chain,
                or paste a public address — an address watches every chain it belongs to.
                Never paste a mnemonic, seed or private key here.
                An extended public key lets its holder track this account&apos;s
                derivable addresses, balances and transaction history. Imported
                keys are stored in this browser (localStorage). They are readable by this site&apos;s
                scripts and by extensions with access to this site.
              </p>
            </div>
          </details>
        </>
      )}

      </div>

      <Link to="/" className="inline-block text-sm underline underline-offset-4">
        Back to wallet
      </Link>
    </div>
  );
}
