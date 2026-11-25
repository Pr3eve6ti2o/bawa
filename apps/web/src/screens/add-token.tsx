/**
 * Add Token dialog (token discovery).
 *
 * One dialog, two modes:
 * - "Add token" (default): pick a chain (EVM → ERC-20, TRON → TRC-20;
 *   BTC/LTC/DOGE are native-coin only, TON Jettons and Solana SPL tokens
 *   are not offered in v1, with the reason shown on the disabled option),
 *   enter the contract, and add it with its real on-chain metadata and
 *   balance. Bad input gets a specific inline error (role="alert"),
 *   nothing is persisted, nothing is added, the input stays intact and
 *   keeps focus.
 * - "Add chain": enable one of the 84 registry chains. No free-text
 *   chain field — an 85th chain is impossible by design. Lane E
 *   (2026-11-24): each row shows the chain's real logo (ChainLogo)
 *   — the 28 chains that used to have no logo now have one.
 *
 * Lane 1: the contract field also accepts a ticker or name ("sushi").
 * An address-shaped input keeps the strict format error; anything else
 * is resolved as a ticker/name (local registry first, then CoinGecko)
 * — one match is filled in and added, several matches are shown for
 * the user to pick, none shows the format error. Search results carry
 * the verified mark (✓ Verified when the token is verified by the
 * isVerifiedToken rule, "Unverified" otherwise), and the add result
 * says which one it is — a token found by ticker search keeps its
 * CoinGecko listing id when the second lookup is rate-limited, so the
 * add does not lose its verified mark.
 *
 * Built on the existing dialog.tsx / Button / Input / Label primitives
 * and the 4-colour drawing-illustration style; the chain picker is a
 * native <select> (the auto-lock-setting precedent — no screen uses the
 * Radix Select, and the native control is fully keyboard-accessible).
 * The dialog content portals to document.body, as DialogContent does
 * for every dialog in this codebase.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChainId } from '../engine/boundary';
import { availableFor, chainConfig, filterChains } from '../wallet/chains';
import { ChainLogo } from './token-logo';
import { useWallet } from '../state/wallet-context';
import {
  DEFAULT_TOKENS,
  COINGECKO_PLATFORM_FOR_CHAIN,
  isDefaultToken,
  isDuplicateToken,
  isVerifiedToken,
  resolveTokenByTickerOrName,
  shortContract,
  tokenStandardFor,
  validateEvmContractAddress,
  validateSolMintAddress,
  validateTonJettonAddress,
  validateTronContractAddress,
  verifiedSourceLabel,
  type AddressValidation,
  type TokenRecord,
  type VerifiedSource,
} from '../wallet/tokens';
import {
  isBannedToken,
  resolveTokenIcon,
  resolveTokenListVerification,
} from '../wallet/token-verification';
import {
  searchTokensByNameOrTicker,
  type TokenSearchCandidate,
} from '../wallet/token-search';
// NOTE: token-balances is dynamically imported at submit time (see
// handleSubmitToken), never statically: it pulls viem's readContract /
// ABI machinery, which must stay out of the eager bundle — the
// wallet-context already loads it lazily for balance refreshes, and a
// static import here would hoist the same machinery into the shared
// chunks and blow the bundle budget (measured +73 KB, 2026-11-22).
import { Button } from '../ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/components/dialog';
import { Input } from '../ui/components/input';
import { Label } from '../ui/components/label';
import { TokenLogo } from './token-logo';

/**
 * The owner's address for a token chain: the vault address first, then
 * the watch-only derived address. Both shapes are handled (a plain
 * string in vaultAddresses, a { address } record in addresses).
 */
function ownerAddressFor(
  wallet: ReturnType<typeof useWallet>,
  chain: ChainId,
): string | undefined {
  const fromVault = wallet.vaultAddresses?.[chain]?.[0];
  if (typeof fromVault === 'string' && fromVault !== '') return fromVault;
  const first: unknown = wallet.addresses?.[chain]?.[0];
  if (typeof first === 'string' && first !== '') return first;
  if (first !== null && typeof first === 'object' && 'address' in first) {
    const address = (first as { address: unknown }).address;
    if (typeof address === 'string' && address !== '') return address;
  }
  return undefined;
}

/**
 * Lane 1: does this input look like an address the user tried to
 * paste, rather than a ticker? Address-shaped input keeps the strict
 * format error; anything else is resolved as a ticker/name. A ticker
 * is at most 11 characters, so the length rules below can never catch
 * one: EVM addresses start with 0x (or are 32+ hex chars without it),
 * TRON addresses are 34 chars starting with T, Solana mints are
 * 32–44 base58 chars, TON masters start with EQ/UQ/0: or are 48 chars.
 */
function looksLikeAddressAttempt(raw: string, chain: ChainId): boolean {
  if (chain === 'trx') return raw.startsWith('T') && raw.length >= 20;
  if (chain === 'sol') return raw.length >= 32;
  if (chain === 'ton') {
    return (
      raw.startsWith('EQ') ||
      raw.startsWith('UQ') ||
      raw.startsWith('0:') ||
      raw.length >= 40
    );
  }
  return raw.startsWith('0x') || raw.length >= 32;
}

/** Format + checksum validation for one chain's contract input. */
function validateContractFor(chain: ChainId, raw: string): AddressValidation {
  if (chain === 'trx') return validateTronContractAddress(raw);
  if (chain === 'sol') return validateSolMintAddress(raw);
  if (chain === 'ton') return validateTonJettonAddress(raw);
  return validateEvmContractAddress(raw);
}

/** One ticker/name resolution: local registry first, then CoinGecko. */
type QueryResolution =
  | { kind: 'found'; candidates: TokenSearchCandidate[] }
  | { kind: 'not-found' }
  | { kind: 'error'; reason: string };

export function AddTokenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const wallet = useWallet();
  const [mode, setMode] = useState<'token' | 'chain'>('token');
  const [chain, setChain] = useState<ChainId>('eth');
  const [contract, setContract] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Token gaps, item 2: find a token by ticker or name. The local
  // registry is tried first; only then CoinGecko. A query that
  // resolves nowhere says so honestly — a token is never invented.
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCandidates, setSearchCandidates] = useState<
    TokenSearchCandidate[] | null
  >(null);
  // Lane 5: the Add-chain list is 84 rows with no way to find one.
  // Same filter helper as the watch-only chain picker.
  const [chainQuery, setChainQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Lane 1: the search candidate the user picked (via Use, or the
  // single match auto-resolved from the contract field). Its
  // CoinGecko id is carried into the add when the second lookup is
  // rate-limited, so a search-found token keeps its verified mark —
  // but only when the chain + contract being added still match it.
  const [pickedCandidate, setPickedCandidate] =
    useState<TokenSearchCandidate | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setMode('token');
    setChain('eth');
    setContract('');
    setError(null);
    setStatus(null);
    setChecking(false);
    setSearchQuery('');
    setSearchCandidates(null);
    setSearchError(null);
    setSearching(false);
    setPickedCandidate(null);
    setChainQuery('');
  }, [open ]);

  // The addable chains are the registry chains with derivation —
  // availableFor('derive') is the full 84 in production. The
  // screen layer only depends on the two chains-module names the
  // screen tests mock (availableFor, chainConfig); importing
  // SUPPORTED_CHAINS here broke those tests at module load even
  // though the dialog never opens there.
  const addableChains = availableFor('derive');
  const enabledChains = wallet.enabledChains ?? [...addableChains];
  const chainDisplayName = chainConfig(chain).displayName;
  const filteredAddChains = filterChains(addableChains, chainQuery);

  const switchMode = (next: 'token' | 'chain') => {
    setMode(next);
    setError(null);
    setStatus(null);
  };

  const onAddChain = (chainId: ChainId) => {
    wallet.setChainEnabled(chainId, true);
    setStatus(`${chainConfig(chainId).displayName} added`);
  };

  // Lane 1: one ticker/name resolution shared by the Search button
  // and the contract field's ticker fallback (see onSubmit). Local
  // registry first (no network): defaults + user-added. Only then
  // CoinGecko. A query that resolves nowhere says so honestly — a
  // token is never invented.
  const resolveQuery = async (query: string): Promise<QueryResolution> => {
    const local = resolveTokenByTickerOrName(query, [
      ...DEFAULT_TOKENS,
      ...(wallet.customTokens ?? []),
    ]);
    if (local.length > 0) {
      return {
        kind: 'found',
        candidates: local.map((record) => ({
          chain: record.chain,
          contract: record.contract,
          name: record.name,
          symbol: record.symbol,
          decimals: record.decimals,
          coingeckoId: record.coingeckoId ?? '',
          // Lane 1: the local candidate's verified state, by the
          // isVerifiedToken rule — a registry default is verified,
          // an unlisted user-added token is not.
          verified: isVerifiedToken(record),
        })),
      };
    }
    const remote = await searchTokensByNameOrTicker(query, globalThis.fetch);
    if (remote.status === 'found') return { kind: 'found', candidates: remote.candidates };
    if (remote.status === 'not-found') return { kind: 'not-found' };
    return { kind: 'error', reason: remote.reason };
  };

  const onSearch = async () => {
    const query = searchQuery.trim();
    if (query === '') {
      setSearchError('Type a ticker or name to search for.');
      setSearchCandidates(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSearchCandidates(null);
    setPickedCandidate(null);
    try {
      const resolved = await resolveQuery(query);
      if (resolved.kind === 'found') {
        setSearchCandidates(resolved.candidates);
      } else if (resolved.kind === 'not-found') {
        setSearchError(
          `No token found for "${query}". Check the spelling, or add it by contract address below.`,
        );
      } else {
        setSearchError(`Search failed: ${resolved.reason}`);
      }
    } finally {
      setSearching(false);
    }
  };

  const onPickCandidate = (candidate: TokenSearchCandidate) => {
    setChain(candidate.chain);
    setContract(candidate.contract);
    setSearchCandidates(null);
    setSearchError(null);
    setPickedCandidate(candidate);
    setStatus(
      `${candidate.name} (${candidate.symbol}) on ${chainConfig(candidate.chain).displayName}. Check the contract below, then Add.`,
    );
    setError(null);
  };

  /**
   * Verify a contract on-chain and add it, with its real metadata.
   * `picked` is the search candidate the contract came from, if any:
   * its CoinGecko id is kept when the second lookup is rate-limited
   * (null), so a search-found token does not lose its verified mark —
   * but only when it names this exact chain + contract.
   */
  const submitWith = async (
    chainId: ChainId,
    contractRaw: string,
    picked: TokenSearchCandidate | null,
  ): Promise<void> => {
    // 1. Format + checksum (no network on bad input).
    const format = validateContractFor(chainId, contractRaw);
    if (!format.ok) {
      setError(format.error);
      inputRef.current?.focus();
      return;
    }
    const normalized = format.normalized;
    // 2. Duplicate in the user-added list (checked before any network
    // call; the wallet also rejects defaults at the persistence boundary
    // and that error is surfaced below).
    if (isDuplicateToken(wallet.customTokens ?? [], chainId, normalized)) {
      setError('Already added');
      inputRef.current?.focus();
      return;
    }
    // 3. An owner address is needed to read the balance.
    const ownerAddress = ownerAddressFor(wallet, chainId);
    if (ownerAddress === undefined) {
      setError('No address is available for this chain yet.');
      inputRef.current?.focus();
      return;
    }
    // 4. On-chain verification: contract, metadata, balance sanity.
    // token-balances is imported lazily here (see the import note at
    // the top of this file) — verification only runs on submit.
    setChecking(true);
    try {
      const {
        verifyEvmToken,
        verifyTronToken,
        verifySplToken,
        verifyJettonToken,
        resolveTokenCoingeckoId,
      } = await import('../wallet/adapters/token-balances');
      const verification =
        chainId === 'trx'
          ? await verifyTronToken({ contract: normalized, ownerAddress })
          : chainId === 'sol'
            ? await verifySplToken({ contract: normalized, ownerAddress })
            : chainId === 'ton'
              ? await verifyJettonToken({
                  contract: normalized,
                  ownerAddress,
                })
              : await verifyEvmToken({
                  chain: chainId,
                  contract: normalized,
                  ownerAddress,
                });
      if (!verification.ok) {
        setError(verification.error);
        inputRef.current?.focus();
        return;
      }
      // 5. Trusted-list verification (token-verify Lane A): the
      // CoinGecko contract lookup first (it also yields the price id
      // and the token image), then the swap lists — Jupiter Strict,
      // 1inch, Uniswap Default, PancakeSwap, Bitget — only when CoinGecko
      // did not verify, so the common path stays one request. A
      // banned mint (Jupiter's banned list, Solana) is refused
      // outright, never added. A token no list holds is still added
      // — it is just Unverified, and its price shows "Price
      // unavailable" unless the DexScreener / TonAPI fallback has
      // it (see token-prices / dex-prices).
      const platform = COINGECKO_PLATFORM_FOR_CHAIN[chainId];
      const coingecko =
        platform === undefined
          ? null
          : await resolveTokenCoingeckoId({ platform, contract: normalized });
      if (await isBannedToken({ chain: chainId, contract: normalized })) {
        setError(
          "This token is on Jupiter's banned-token list — it can't be added.",
        );
        inputRef.current?.focus();
        return;
      }
      const lists =
        coingecko !== null
          ? null
          : await resolveTokenListVerification({
              chain: chainId,
              contract: normalized,
            });
      // Lane 1: a token found by ticker search is CoinGecko-confirmed
      // — keep its listing id when this lookup is rate-limited (null),
      // so the add does not lose its verified mark.
      const pickedId =
        picked !== null &&
        picked.chain === chainId &&
        picked.contract.toLowerCase() === normalized.toLowerCase() &&
        picked.coingeckoId !== ''
          ? picked.coingeckoId
          : null;
      const coingeckoId = coingecko?.id ?? pickedId;
      const verifiedSource: VerifiedSource | null =
        coingecko !== null || pickedId !== null
          ? 'coingecko'
          : (lists?.source ?? null);
      const icon = await resolveTokenIcon({
        chain: chainId,
        contract: normalized,
        coingeckoImage:
          coingecko?.image ?? picked?.iconUrl ?? null,
        listLogoUri: lists?.logoUri ?? null,
      });
      const record: TokenRecord = {
        chain: chainId,
        contract: normalized,
        name: verification.metadata.name,
        symbol: verification.metadata.symbol,
        decimals: verification.metadata.decimals,
        coingeckoId,
        addedAtMs: Date.now(),
        verifiedSource,
        iconUrl: icon.iconUrl,
        iconSource: icon.iconSource,
      };
      const added = wallet.addCustomToken(record);
      if (!added.ok) {
        setError(added.error);
        inputRef.current?.focus();
        return;
      }
      // Lane 1: the add result says whether the token is verified —
      // and, when it is, which list verified it.
      setStatus(
        isVerifiedToken(record) && verifiedSource !== null
          ? `Token added — ✓ Verified (${verifiedSourceLabel(verifiedSource)})`
          : 'Token added — Unverified',
      );
    } finally {
      setChecking(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    // TEMPORARY devnet mode (UI/UX fixes, item 2): token verification
    // reads mainnet contracts on mainnet RPCs. Adding a token in
    // devnet mode would verify — and persist — a mainnet token while
    // the wallet is on test networks, so the submit is off here; the
    // button is disabled too, this is the programmatic backstop.
    if (wallet.devnetEnabled) {
      setError('Adding tokens is off in devnet test mode.');
      return;
    }
    const raw = contract.trim();
    const format = validateContractFor(chain, raw);
    if (!format.ok) {
      // Lane 1: the contract field also accepts a ticker/symbol
      // ("sushi"). An address-shaped input keeps the strict format
      // error; anything else is resolved as a ticker/name first — one
      // match is filled in and added, several are shown for the user
      // to pick, none falls back to the format error.
      if (looksLikeAddressAttempt(raw, chain)) {
        setError(format.error);
        inputRef.current?.focus();
        return;
      }
      setChecking(true);
      try {
        const resolved = await resolveQuery(raw);
        if (resolved.kind === 'error') {
          setError(`Search failed: ${resolved.reason}`);
          inputRef.current?.focus();
          return;
        }
        if (resolved.kind === 'not-found' || resolved.candidates.length === 0) {
          setError(format.error);
          inputRef.current?.focus();
          return;
        }
        if (resolved.candidates.length === 1) {
          const [only] = resolved.candidates;
          if (only === undefined) {
            setError(format.error);
            inputRef.current?.focus();
            return;
          }
          setPickedCandidate(only);
          setChain(only.chain);
          setContract(only.contract);
          await submitWith(only.chain, only.contract, only);
          return;
        }
        setSearchCandidates(resolved.candidates);
        setPickedCandidate(null);
        setStatus(
          `"${raw}" matches ${resolved.candidates.length} tokens — pick one, then Add.`,
        );
        inputRef.current?.focus();
        return;
      } finally {
        setChecking(false);
      }
    }
    // The picked candidate still applies when the user pressed Use
    // and then Add without editing the contract.
    const picked =
      pickedCandidate !== null &&
      pickedCandidate.chain === chain &&
      pickedCandidate.contract.toLowerCase() === format.normalized.toLowerCase()
        ? pickedCandidate
        : null;
    await submitWith(chain, raw, picked);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add token</DialogTitle>
          <DialogDescription>
            Add a chain to your wallet, or add a token by ticker or contract address.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="group" aria-label="Add mode">
          <Button
            type="button"
            variant={mode === 'token' ? 'default' : 'secondary'}
            onClick={() => switchMode('token')}
          >
            Add token
          </Button>
          <Button
            type="button"
            variant={mode === 'chain' ? 'default' : 'secondary'}
            onClick={() => switchMode('chain')}
          >
            Add chain
          </Button>
        </div>

        {mode === 'chain' ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="add-chain-search">Find a chain</Label>
            <Input
              id="add-chain-search"
              value={chainQuery}
              onChange={(event) => setChainQuery(event.target.value)}
              placeholder="e.g. Arbitrum"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
            />
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {filteredAddChains.map((chainId) => {
              const config = chainConfig(chainId);
              const enabled = enabledChains.includes(chainId);
              return (
                <li
                  key={chainId}
                  className="flex items-center justify-between gap-3 rounded-bawa border-2 border-ink bg-paper px-3 py-2"
                >
                  <ChainLogo chain={chainId} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {config.displayName}
                    </span>
                    <span className="block text-xs text-ink/70">{config.symbol}</span>
                  </span>
                  {enabled ? (
                    <span className="shrink-0 text-sm font-medium text-ink/70">Enabled</span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => onAddChain(chainId)}
                    >
                      Add
                    </Button>
                  )}
                </li>
              );
            })}
            {filteredAddChains.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink">
                No chains match &ldquo;{chainQuery.trim()}&rdquo;.
              </li>
            )}
          </ul>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {wallet.devnetEnabled && (
              <p className="text-sm font-medium text-ink">
                Adding tokens is off in devnet test mode — switch back to
                mainnet to add a token.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-token-search">Find by name or ticker</Label>
              {/* Lane 5: the Search button used to sit beside the input
                  at every width, squeezing the input until its
                  placeholder clipped at 390 px. Stacked on phones,
                  side by side from sm up. */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id="add-token-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="e.g. USDC"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  inputMode="text"
                />
                <Button type="button" variant="secondary" onClick={onSearch} disabled={searching}>
                  {searching ? 'Searching…' : 'Search'}
                </Button>
              </div>
              <p className="text-xs text-ink/70">
                Searching finds the token&apos;s chain and contract. If it is not found,
                add it by contract address below.
              </p>
              {searchError !== null && (
                <p role="alert" className="text-sm font-medium text-ink">
                  {searchError}
                </p>
              )}
              {searchCandidates !== null && searchCandidates.length > 0 && (
                <ul className="flex max-h-[40vh] flex-col gap-2 overflow-y-auto">
                  {searchCandidates.map((candidate) => (
                    <li key={`${candidate.chain}:${candidate.contract}`}>
                      <button
                        type="button"
                        onClick={() => onPickCandidate(candidate)}
                        className="flex w-full items-center justify-between gap-3 rounded-bawa border-2 border-ink bg-paper px-3 py-2 text-left"
                      >
                        {/* Lane A: the candidate's icon — its CoinGecko
                            image when search found one, the bundled
                            symbol logo only for a curated default, the
                            link mark otherwise (never an invented
                            icon for a token that merely shares a
                            symbol with a known one). */}
                        <TokenLogo
                          symbol={candidate.symbol}
                          size={32}
                          iconUrl={candidate.iconUrl ?? null}
                          allowSymbolLogo={isDefaultToken({
                            chain: candidate.chain,
                            contract: candidate.contract,
                            name: candidate.name,
                            symbol: candidate.symbol,
                            decimals: candidate.decimals,
                            coingeckoId: candidate.coingeckoId,
                            addedAtMs: 0,
                          })}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {candidate.name} ({candidate.symbol})
                            {/* Lane 1: the verified mark on the search
                                result itself — a CoinGecko-confirmed
                                match is verified, a registry token
                                without a listing is not. */}
                            {candidate.verified ? (
                              <span className="ml-2 text-sm font-normal" aria-label="Verified token">✓ Verified</span>
                            ) : (
                              <span className="ml-2 text-sm font-normal" aria-label="Unverified token">Unverified</span>
                            )}
                          </span>
                          <span className="block text-xs text-ink/70">
                            {chainConfig(candidate.chain).displayName} ·{' '}
                            {shortContract(candidate.contract)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-ink/70">Use</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-token-chain">Chain</Label>
              <select
                id="add-token-chain"
                value={chain}
                onChange={(event) => {
                  setChain(event.target.value as ChainId);
                  setError(null);
                }}
                className="h-11 rounded-bawa border-2 border-ink bg-paper px-3 text-sm font-medium text-ink"
              >
                {addableChains.map((chainId) => {
                  const config = chainConfig(chainId);
                  const standard = tokenStandardFor(chainId);
                  const disabled = standard.standard === null;
                  const label = disabled
                    ? `${config.displayName} — ${standard.reason ?? 'Not supported'}`
                    : config.displayName;
                  return (
                    <option key={chainId} value={chainId} disabled={disabled}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="add-token-contract">
                {chain === 'sol'
                  ? 'Solana mint address'
                  : chain === 'ton'
                    ? 'TON Jetton master address'
                    : `${chainDisplayName} contract address`}
              </Label>
              <Input
                id="add-token-contract"
                ref={inputRef}
                value={contract}
                onChange={(event) => setContract(event.target.value)}
                placeholder={
                  chain === 'trx'
                    ? 'T…'
                    : chain === 'sol'
                      ? 'EPjF…'
                      : chain === 'ton'
                        ? 'EQ…'
                        : '0x…'
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                inputMode="text"
              />
            </div>

            {error !== null && (
              <p role="alert" className="text-sm font-medium text-ink">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={checking || wallet.devnetEnabled}>
              {checking ? 'Checking…' : 'Add'}
            </Button>
          </form>
        )}

        {status !== null && (
          <p role="status" className="text-sm font-medium text-ink">
            {status}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
