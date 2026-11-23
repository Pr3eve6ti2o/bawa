import { describe, expect, it } from 'vitest';
import {
  addCustomRpcEndpoint,
  isCustomRpcOriginUsable,
  makePrimaryEndpoint,
  removeRpcEndpoint,
  resolveRpcEndpoints,
  RPC_OVERRIDES_KEY,
  SUGGESTED_CUSTOM_RPCS,
  type RpcOverrideStorage,
} from './chains';

/** In-memory stand-in for localStorage: the functions take it explicitly. */
function memoryStorage(initial: Record<string, string> = {}): RpcOverrideStorage {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe('RPC make-primary (Lane F, FIX-ALL)', () => {
  it('moves any listed endpoint to the front, including a custom one added third', () => {
    const storage = memoryStorage();
    addCustomRpcEndpoint('eth', 'https://rpc.flashbots.net', storage);
    expect(resolveRpcEndpoints('eth', storage)).toEqual([
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://rpc.flashbots.net',
    ]);
    // promoteBackupEndpoint only swaps the first two, so it could
    // never bring the third entry forward — makePrimaryEndpoint can.
    expect(makePrimaryEndpoint('eth', 'https://rpc.flashbots.net', storage)).toBe(
      true,
    );
    expect(resolveRpcEndpoints('eth', storage)).toEqual([
      'https://rpc.flashbots.net',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ]);
  });

  it('returns false for an unlisted URL and true when already primary', () => {
    const storage = memoryStorage();
    expect(makePrimaryEndpoint('eth', 'https://nope.invalid', storage)).toBe(
      false,
    );
    expect(
      makePrimaryEndpoint(
        'eth',
        'https://ethereum-rpc.publicnode.com',
        storage,
      ),
    ).toBe(true);
    expect(resolveRpcEndpoints('eth', storage)).toEqual([
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ]);
  });

  it('drops the override when the list returns to the registry defaults', () => {
    const storage = memoryStorage();
    addCustomRpcEndpoint('eth', 'https://rpc.flashbots.net', storage);
    makePrimaryEndpoint('eth', 'https://rpc.flashbots.net', storage);
    expect(storage.getItem(RPC_OVERRIDES_KEY)).not.toBeNull();
    // Move the registry primary back to the front, then remove the
    // custom entry: the list is the registry defaults again, so the
    // stored override must disappear.
    makePrimaryEndpoint('eth', 'https://ethereum-rpc.publicnode.com', storage);
    expect(resolveRpcEndpoints('eth', storage)).toEqual([
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.flashbots.net',
      'https://eth.drpc.org',
    ]);
    expect(storage.getItem(RPC_OVERRIDES_KEY)).not.toBeNull();
    removeRpcEndpoint('eth', 'https://rpc.flashbots.net', storage);
    expect(resolveRpcEndpoints('eth', storage)).toEqual([
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
    ]);
    expect(storage.getItem(RPC_OVERRIDES_KEY)).toBeNull();
  });
});

describe('custom RPC allowlist (Lane F, FIX-ALL)', () => {
  it('accepts registry origins and the suggested public RPCs', () => {
    expect(
      isCustomRpcOriginUsable('https://ethereum-rpc.publicnode.com'),
    ).toBe(true);
    expect(isCustomRpcOriginUsable('https://eth.drpc.org')).toBe(true);
    // 1RPC is gone (FIX-ALL Lane A, 2026-11-24): both 1RPC backups
    // returned -32001 usage-limit and were replaced by dRPC.
    expect(isCustomRpcOriginUsable('https://1rpc.io/eth')).toBe(false);
    for (const suggestion of SUGGESTED_CUSTOM_RPCS) {
      expect(isCustomRpcOriginUsable(suggestion.url)).toBe(true);
    }
  });

  it('rejects any other origin — the browser would refuse its fetches', () => {
    expect(isCustomRpcOriginUsable('https://custom.invalid/eth')).toBe(false);
    expect(isCustomRpcOriginUsable('https://rpc.ankr.com/eth')).toBe(false);
    expect(isCustomRpcOriginUsable('https://eth.llamarpc.com')).toBe(false);
    expect(isCustomRpcOriginUsable('not a url')).toBe(false);
  });

  it('lists the two verified one-tap suggestions, both for Ethereum', () => {
    expect(SUGGESTED_CUSTOM_RPCS).toEqual([
      { chain: 'eth', label: 'Flashbots', url: 'https://rpc.flashbots.net' },
      { chain: 'eth', label: 'dRPC', url: 'https://eth.drpc.org' },
    ]);
  });
});
