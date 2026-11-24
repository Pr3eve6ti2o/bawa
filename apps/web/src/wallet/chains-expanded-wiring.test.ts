import { describe, expect, it } from 'vitest';
import type { ChainId } from '../engine/boundary';
import { SUPPORTED_CHAINS, chainConfig } from './chains';
import { EXPANDED_CHAINS } from './chains-expanded';
import {
  deriveAddresses,
  deriveAddressesAt,
  deriveFromXpub,
  getAccountExtendedPublicKey,
} from './core';
import { validateWatchOnlyImport } from '../engine/boundary';
import {
  EVM_TX_CHAINS,
  EVM_WATCH_CHAINS,
  isEvmChain,
  isEvmTxChain,
} from './watch-only-families';
import { CHAIN_DECIMALS } from './chain-amount-format';
import { PRICE_ASSET_IDS, PRICE_IDS } from './prices';
import { priceFallbackSourcesFor } from './price-fallbacks';
import { chainLogoFor } from '../screens/token-logo';
import { registerAllAdapters, registeredChains } from './adapters';

// BIP-39 test-vector mnemonic, empty passphrase, no funds (same fixture
// as core.test.ts). Expected addresses below are the Wallet Core 4.9.3
// probe outputs (Lane 80-APP probes 3 + 4, 2026-11-24).
const TEST_VECTOR_MNEMONIC = 'abandon '.repeat(11) + 'about';

const EXPECTED: Record<string, string> = {
    zksync: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    cronos: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    kava: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    filecoin: 'f1qode47ievxlxzk6z2viuovedabmn3tq6t57uqhq',
    zora: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    mode: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    fraxtal: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    berachain: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    sei: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    arbnova: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    worldchain: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    manta: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    unichain: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    ink: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    abstract: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    soneium: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    apechain: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    sonic: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    hyperevm: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    monad: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    ronin: 'ronin:9858EfFD232B4033E47d90003D41EC34EcaEda94',
    immutable: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    fuse: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    velas: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    syscoin: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    theta: '0xB16f8D941d7D281aDCEf3e950aBF2147D7AC2D33',
    iotex: '0x1D39DD01342203b5E9b9C5b0205a9aC2b887cE00',
    xlayer: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    boba: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    taiko: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    astar: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    telos: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    conflux: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    core: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    songbird: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    rootstock: '0xa2CC70eE855b5f577eeCA688539D8a022550de45',
    pulsechain: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    xdc: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    chiliz: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    etc: '0xFA22515E43658ce56A7682B801e9B5456f511420',
    flare: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    zetachain: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    hemi: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    bob: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    flowevm: '0x9858EfFD232B4033E47d90003D41EC34EcaEda94',
    cosmos: 'cosmos19rl4cm2hmr8afy4kldpxz3fka4jguq0auqdal4',
    osmosis: 'osmo19rl4cm2hmr8afy4kldpxz3fka4jguq0a5m7df8',
    xrp: 'rHsMGQEkVNJmpGWs8XUBoTBiAAbwxZN5v3',
    stellar: 'GB3JDWCQJCWMJ3IILWIGDTQJJC5567PGVEVXSCVPEQOTDN64VJBDQBYX',
    polkadot: '14E9StbjYhJiAfsNMEcq5tETq79Q6EqaGyebdziY214hNWDH',
    near: '5510e2b44cae6eb807e3e0e45d579dda058c274abcba15e5cb84636f5d1ee412',
    aptos: '0xeb663b681209e7087d681c5d3eed12aaa8e1915e7c87794542c3f96e94b3d3bf',
    tezos: 'tz1VQA4RP4fLjEEMW2FR4pE9kAg5abb5h5GL',
    algorand: 'EP2D7TV7IAFANZHK3B6QLKB53N5UTD7RARVXZTWCPCRQQBKYVGM2XIMT2Q',
    hedera: '0.0.302a300506032b6570032100793af21fd5a0a7cc1076195263717fab12600496dfc7ad49e902acdd0bf22331',
    injective: 'inj1npvwllfr9dqr8erajqqr6s0vxnk2ak55re90dz',
    celestia: 'celestia19rl4cm2hmr8afy4kldpxz3fka4jguq0ad2ud9c',
    dydx: 'dydx19rl4cm2hmr8afy4kldpxz3fka4jguq0a4erelz',
    seicosmos: 'sei19rl4cm2hmr8afy4kldpxz3fka4jguq0a3vute5',
    axelar: 'axelar19rl4cm2hmr8afy4kldpxz3fka4jguq0acwm455',
    noble: 'noble19rl4cm2hmr8afy4kldpxz3fka4jguq0a5rc48m',
    juno: 'juno19rl4cm2hmr8afy4kldpxz3fka4jguq0a2jwxcf',
};

// Index-1 addresses (xpub-derived, probe 4): the deriveAddressesAt
// pubkey-form check — the Cosmos-family chains only agree with the
// COMPRESSED pubkey, filecoin only with the uncompressed one.
const EXPECTED_INDEX_1: Record<string, string> = {
  cosmos: 'cosmos1jrkmdcwgq94uaamx6zax2luewlhf7u4kucx3kz',
  xrp: 'r3AgF9mMBFtaLhKcg96weMhbbEFLZ3mx17',
  filecoin: 'f12nzdrhfh6caurft7gwy6d3uazvgy3lhl7rfzvpq',
  theta: '0xf2142cb79CEEC9aD39C15151CdEa90f0b853EA1C',
  ronin: 'ronin:6Fac4D18c912343BF86fa7049364Dd4E424Ab9C0',
  injective: 'inj1d7ky6xxfzg6rh7r05uzfxexafepy4wwqp4z8h8',
  celestia: 'celestia1jrkmdcwgq94uaamx6zax2luewlhf7u4kdjhpv0',
};

// Full test-vector xpubs (probe 5, 2026-11-24).
const ZKSYNC_XPUB =
  'xpub6DCoCpSuQZB2jawqnGMEPS63ePKWkwWPH4TU45Q7LPXWuNd8TMtVxRrgjtEshuqpK3mdhaWHPFsBngh5GFZaM6si3yZdUsT8ddYM3PwnATt';
const COSMOS_XPUB =
  'xpub6DGzViq8bmgMLYdVZ3xnLVEdKwzBnGdzzJZ4suG8kVb9TTLAbrwv8YdKBb8FWKdBNinaHKmBv7JpQvqBYx4rxch7WnHzNFzSVrMf8hQepTP';
const FILECOIN_XPUB =
  'xpub6D2RAta9bdnVzbRSCqZHMeiEiVd19V8g3sP92jHFLrfNDjGgJ5Rfej7j4Bc3sYNUbgfgY1kjTJkKhycEitDjUAjXyvUqx5TBFyQTzsQHhZE';
// What Wallet Core exports for Stellar (an Ed25519 chain): a key no
// derivation can consume — the wallet must refuse it, never store it.
const STELLAR_XPUB =
  'xpub6CzpMbupTF2cqWtmnPt2ZYfvyvQWwwU2PJimxZh9vWr9UcvjG3rbxGfz5eYxckWdTHjDq5yCDJtcQgzfVFSMMceBNRdwBu3PtmAtVHqR2ZM';

const ED25519_NO_XPUB = ['stellar', 'polkadot', 'near', 'aptos', 'tezos', 'algorand', 'hedera'] as const;

describe('chains-expanded wiring (Lane 80-APP)', () => {
  it('covers all 84 chains: the 22 existing plus the 62 expanded', () => {
    expect(EXPANDED_CHAINS).toHaveLength(62);
    expect(SUPPORTED_CHAINS).toHaveLength(84);
    for (const c of EXPANDED_CHAINS) {
      expect(SUPPORTED_CHAINS).toContain(c.key);
      expect(chainConfig(c.key as ChainId).displayName).toBe(c.displayName);
      expect(chainConfig(c.key as ChainId).symbol).toBe(c.symbol);
      expect(chainConfig(c.key as ChainId).evmChainId).toBe(c.evmChainId);
      expect(chainConfig(c.key as ChainId).networkId).toBe(c.networkId);
      expect(chainConfig(c.key as ChainId).assetId).toBe(c.assetId);
      expect(chainConfig(c.key as ChainId).rpcEndpoints).toEqual(c.rpcEndpoints);
    }
  });

  it('derives the probe test-vector addresses on all 62 new chains', async () => {
    const addresses = await deriveAddresses(TEST_VECTOR_MNEMONIC);
    for (const [key, expected] of Object.entries(EXPECTED)) {
      expect(addresses[key as keyof typeof addresses], key).toBe(expected);
    }
  });

  it('derives the same address at account 0 index 0 via both paths, and the probed index-1 addresses', async () => {
    const at00 = await deriveAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 0);
    const base = await deriveAddresses(TEST_VECTOR_MNEMONIC);
    expect(at00).toEqual(base);
    const at01 = await deriveAddressesAt(TEST_VECTOR_MNEMONIC, '', 0, 1);
    for (const [key, expected] of Object.entries(EXPECTED_INDEX_1)) {
      expect(at01[key as keyof typeof at01], key).toBe(expected);
    }
  });

  it('templates expand to the recorded derivation path at account 0 index 0', () => {
    for (const c of EXPANDED_CHAINS) {
      const config = chainConfig(c.key as ChainId);
      expect(config.pathFor(0, 0), c.key).toBe(c.derivationPath);
    }
  });

  it('round-trips the xpub for the 55 secp256k1 chains and refuses it for the 7 Ed25519 chains', async () => {
    for (const c of EXPANDED_CHAINS) {
      if ((ED25519_NO_XPUB as readonly string[]).includes(c.key)) {
        await expect(
          getAccountExtendedPublicKey(TEST_VECTOR_MNEMONIC, '', c.key as ChainId, 0),
        ).rejects.toThrow(/Ed25519/);
        await expect(deriveFromXpub(c.key as ChainId, STELLAR_XPUB, 0)).rejects.toThrow(
          /Ed25519/,
        );
        continue;
      }
      const xpub = await getAccountExtendedPublicKey(
        TEST_VECTOR_MNEMONIC,
        '',
        c.key as ChainId,
        0,
      );
      expect(xpub.startsWith('xpub'), c.key).toBe(true);
      expect(await deriveFromXpub(c.key as ChainId, xpub, 0), c.key).toBe(EXPECTED[c.key]);
    }
    expect(await deriveFromXpub('zksync', ZKSYNC_XPUB, 0)).toBe(EXPECTED.zksync);
    expect(await deriveFromXpub('cosmos', COSMOS_XPUB, 0)).toBe(EXPECTED.cosmos);
    expect(await deriveFromXpub('filecoin', FILECOIN_XPUB, 0)).toBe(EXPECTED.filecoin);
  });

  it('validates watch-only imports for the new chains', async () => {
    // A 0x address is an address on every 0x EVM chain.
    expect(await validateWatchOnlyImport('zksync', '0x9858EfFD232B4033E47d90003D41EC34EcaEda94')).toEqual({
      ok: true,
      kind: 'address',
    });
    // A Cosmos address validates through Wallet Core, not viem.
    expect(await validateWatchOnlyImport('cosmos', EXPECTED.cosmos!)).toEqual({
      ok: true,
      kind: 'address',
    });
    // A Ronin address keeps its ronin: prefix.
    expect(await validateWatchOnlyImport('ronin', EXPECTED.ronin!)).toEqual({
      ok: true,
      kind: 'address',
    });
    // An xpub imports as an xpub on a secp256k1 chain…
    expect(await validateWatchOnlyImport('zksync', ZKSYNC_XPUB)).toEqual({
      ok: true,
      kind: 'xpub',
    });
    // …but never on an Ed25519 chain, even though Wallet Core exports one.
    const stellar = await validateWatchOnlyImport('stellar', STELLAR_XPUB);
    expect(stellar.ok).toBe(false);
  });

  it('keeps the 0x EVM family at 59 chains and the EVM-transaction set at 60', () => {
    expect(EVM_WATCH_CHAINS).toHaveLength(59);
    expect(EVM_TX_CHAINS).toHaveLength(60);
    expect(EVM_TX_CHAINS).toContain('ronin');
    expect(EVM_WATCH_CHAINS).not.toContain('ronin');
    expect(EVM_WATCH_CHAINS).not.toContain('filecoin');
    for (const chain of EVM_WATCH_CHAINS) expect(isEvmChain(chain)).toBe(true);
    for (const chain of EVM_TX_CHAINS) expect(isEvmTxChain(chain)).toBe(true);
    expect(isEvmChain('ronin')).toBe(false);
    expect(isEvmTxChain('ronin')).toBe(true);
    expect(isEvmChain('filecoin')).toBe(false);
    expect(isEvmTxChain('filecoin')).toBe(false);
    expect(isEvmChain('cosmos')).toBe(false);
  });

  it('registers the EVM adapter for all 60 EVM-transaction chains', () => {
    registerAllAdapters();
    const registered = registeredChains();
    for (const chain of EVM_TX_CHAINS) {
      expect(registered, chain).toContain(chain);
    }
    expect(registered).not.toContain('filecoin');
    expect(registered).not.toContain('cosmos');
  });

  it('covers all 84 chains in the price maps, with a fallback for 77', () => {
    expect(Object.keys(PRICE_IDS).sort()).toEqual([...SUPPORTED_CHAINS].sort());
    expect(Object.keys(PRICE_ASSET_IDS).sort()).toEqual([...SUPPORTED_CHAINS].sort());
    for (const chain of SUPPORTED_CHAINS) {
      expect(PRICE_ASSET_IDS[chain]).toBe(chainConfig(chain).assetId);
    }
    const withFallback = SUPPORTED_CHAINS.filter(
      (chain) => priceFallbackSourcesFor(chain).length > 1,
    );
    expect(withFallback).toHaveLength(77);
    // The seven CoinGecko-only chains, named honestly.
    for (const chain of ['fraxtal', 'velas', 'telos', 'songbird', 'rootstock', 'pulsechain', 'xdc'] as const) {
      expect(priceFallbackSourcesFor(chain)).toEqual(['CoinGecko']);
    }
  });

  it('covers all 84 chains in CHAIN_DECIMALS', () => {
    expect(Object.keys(CHAIN_DECIMALS).sort()).toEqual([...SUPPORTED_CHAINS].sort());
    // Spot-check the non-18-decimal chains (Trust Wallet Core registry).
    const non18: Record<string, number> = {
      cosmos: 6, osmosis: 6, xrp: 6, tezos: 6, algorand: 6, celestia: 6,
      seicosmos: 6, axelar: 6, noble: 6, juno: 6, stellar: 7, polkadot: 10,
      near: 24, aptos: 8, hedera: 8,
    };
    for (const [key, decimals] of Object.entries(non18)) {
      expect(CHAIN_DECIMALS[key as keyof typeof CHAIN_DECIMALS], key).toBe(decimals);
    }
  });

  it('has a real logo for all 62 expanded chains', () => {
    // Lane E (2026-11-24): the 28 chains without a Trust Wallet Assets
    // directory now have a bundled real mark (DefiLlama / CoinGecko /
    // Tatum), so every expanded chain resolves to a logo.
    const withIcon = EXPANDED_CHAINS.filter((c) => c.iconUrl !== null).map((c) => c.key);
    expect(withIcon).toHaveLength(62);
    for (const key of withIcon) {
      expect(chainLogoFor(key), key).toBeDefined();
    }
  });
});
