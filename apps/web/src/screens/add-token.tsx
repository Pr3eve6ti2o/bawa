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
 * - "Add chain": enable one of the 13 registry chains. No free-text
 *   chain field — a 14th chain is impossible by design.
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
import { availableFor, chainConfig } from '../wallet/chains';
import { useWallet } from '../state/wallet-context';
import {
  DEFAULT_TOKENS,
  isDuplicateToken,
  resolveTokenByTickerOrName,
  shortContract,
  tokenStandardFor,
  validateEvmContractAddress,
  validateTronContractAddress,
  type TokenRecord,
} from '../wallet/tokens';
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

/** CoinGecko platform slug per token chain (see token-balances.ts). */
const COINGECKO_PLATFORM_FOR_CHAIN: Partial<
  Record<
    ChainId,
    | 'ethereum'
    | 'tron'
    | 'binance-smart-chain'
    | 'polygon-pos'
    | 'arbitrum-one'
    | 'optimistic-ethereum'
    | 'base'
    | 'avalanche'
  >
> = {
  eth: 'ethereum',
  trx: 'tron',
  bsc: 'binance-smart-chain',
  matic: 'polygon-pos',
  arb: 'arbitrum-one',
  op: 'optimistic-ethereum',
  base: 'base',
  avax: 'avalanche',
};

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
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
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
  }, [open ]);

  // The addable chains are the registry chains with derivation —
  // availableFor('derive') is the full 13 in production. The
  // screen layer only depends on the two chains-module names the
  // screen tests mock (availableFor, chainConfig); importing
  // SUPPORTED_CHAINS here broke those tests at module load even
  // though the dialog never opens there.
  const addableChains = availableFor('derive');
  const enabledChains = wallet.enabledChains ?? [...addableChains];
  const chainDisplayName = chainConfig(chain).displayName;

  const switchMode = (next: 'token' | 'chain') => {
    setMode(next);
    setError(null);
    setStatus(null);
  };

  const onAddChain = (chainId: ChainId) => {
    wallet.setChainEnabled(chainId, true);
    setStatus(`${chainConfig(chainId).displayName} added`);
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
    try {
      // Local registry first (no network): defaults + user-added.
      const local = resolveTokenByTickerOrName(query, [
        ...DEFAULT_TOKENS,
        ...(wallet.customTokens ?? []),
      ]);
      if (local.length > 0) {
        setSearchCandidates(
          local.map((record) => ({
            chain: record.chain,
            contract: record.contract,
            name: record.name,
            symbol: record.symbol,
            decimals: record.decimals,
            coingeckoId: record.coingeckoId ?? '',
          })),
        );
        return;
      }
      const remote = await searchTokensByNameOrTicker(query, globalThis.fetch);
      if (remote.status === 'found') {
        setSearchCandidates(remote.candidates);
      } else if (remote.status === 'not-found') {
        setSearchError(
          `No token found for "${query}". Check the spelling, or add it by contract address below.`,
        );
      } else {
        setSearchError(`Search failed: ${remote.reason}`);
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
    setStatus(
      `${candidate.name} (${candidate.symbol}) on ${chainConfig(candidate.chain).displayName} — check the contract below, then Add.`,
    );
    setError(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setStatus(null);
    const raw = contract.trim();
    // 1. Format + checksum (no network on bad input).
    let normalized: string;
    if (chain === 'trx') {
      const format = validateTronContractAddress(raw);
      if (!format.ok) {
        setError(format.error);
        inputRef.current?.focus();
        return;
      }
      normalized = format.normalized;
    } else {
      const format = validateEvmContractAddress(raw);
      if (!format.ok) {
        setError(format.error);
        inputRef.current?.focus();
        return;
      }
      normalized = format.normalized;
    }
    // 2. Duplicate in the user-added list (checked before any network
    // call; the wallet also rejects defaults at the persistence boundary
    // and that error is surfaced below).
    if (isDuplicateToken(wallet.customTokens ?? [], chain, normalized)) {
      setError('Already added');
      inputRef.current?.focus();
      return;
    }
    // 3. An owner address is needed to read the balance.
    const ownerAddress = ownerAddressFor(wallet, chain);
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
      const { verifyEvmToken, verifyTronToken, resolveTokenCoingeckoId } =
        await import('../wallet/adapters/token-balances');
      const verification =
        chain === 'trx'
          ? await verifyTronToken({ contract: normalized, ownerAddress })
          : await verifyEvmToken({ chain, contract: normalized, ownerAddress });
      if (!verification.ok) {
        setError(verification.error);
        inputRef.current?.focus();
        return;
      }
      // 5. CoinGecko id for the price feed; 404 → still added, price
      // shows "Price unavailable".
      const platform = COINGECKO_PLATFORM_FOR_CHAIN[chain];
      const coingeckoId =
        platform === undefined
          ? null
          : await resolveTokenCoingeckoId({ platform, contract: normalized });
      const record: TokenRecord = {
        chain,
        contract: normalized,
        name: verification.metadata.name,
        symbol: verification.metadata.symbol,
        decimals: verification.metadata.decimals,
        coingeckoId,
        addedAtMs: Date.now(),
      };
      const added = wallet.addCustomToken(record);
      if (!added.ok) {
        setError(added.error);
        inputRef.current?.focus();
        return;
      }
      setStatus('Token added');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add token</DialogTitle>
          <DialogDescription>
            Add a chain to your wallet, or add a token by its contract address.
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
          <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {addableChains.map((chainId) => {
              const config = chainConfig(chainId);
              const enabled = enabledChains.includes(chainId);
              return (
                <li
                  key={chainId}
                  className="flex items-center justify-between gap-3 rounded-bawa border-2 border-ink bg-paper px-3 py-2"
                >
                  <span className="min-w-0">
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
          </ul>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="add-token-search">Find by name or ticker</Label>
              <div className="flex gap-2">
                <Input
                  id="add-token-search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="e.g. USDC or USD Coin"
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
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink">
                            {candidate.name} ({candidate.symbol})
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
              <Label htmlFor="add-token-contract">{chainDisplayName} contract address</Label>
              <Input
                id="add-token-contract"
                ref={inputRef}
                value={contract}
                onChange={(event) => setContract(event.target.value)}
                placeholder={chain === 'trx' ? 'T…' : '0x…'}
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

            <Button type="submit" disabled={checking}>
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
