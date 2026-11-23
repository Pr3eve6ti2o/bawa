// Shared lazy adapter loading (Lane 4 consolidation).
//
// The adapter chunk (viem + adapters, ~3 MB) must not load before first
// paint. First caller imports it and registers the adapters once;
// concurrent callers share the promise. A rejected import clears the
// cache so a later call retries.
//
// This used to be defined twice — once in state/wallet-context.tsx and
// once in state/wallet-refresh.ts — with separate caches, so the chunk
// could load and register twice. There is one cache now.
// state/wallet-context.tsx re-exports both loaders so the send screen's
// import path is unchanged.

let adaptersPromise: Promise<typeof import('../wallet/adapters')> | null = null;

export function ensureAdapters(): Promise<typeof import('../wallet/adapters')> {
  if (adaptersPromise) return adaptersPromise;
  const promise = import('../wallet/adapters').then((adapters) => {
    adapters.registerAllAdapters();
    return adapters;
  });
  adaptersPromise = promise;
  void promise.catch(() => {
    if (adaptersPromise === promise) adaptersPromise = null;
  });
  return promise;
}

let devnetAdaptersPromise: Promise<typeof import('../wallet/adapters')> | null = null;

// TEMPORARY devnet mode: the devnet adapter registry (Sepolia, Nile,
// testnet4, TON testnet) loads lazily like the mainnet one and never
// replaces it. Exported for the send screen's devnet broadcast path.
export function ensureDevnetAdapters(): Promise<typeof import('../wallet/adapters')> {
  if (devnetAdaptersPromise) return devnetAdaptersPromise;
  const promise = import('../wallet/adapters').then((adapters) => {
    adapters.registerDevnetAdapters();
    return adapters;
  });
  devnetAdaptersPromise = promise;
  void promise.catch(() => {
    if (devnetAdaptersPromise === promise) devnetAdaptersPromise = null;
  });
  return promise;
}
