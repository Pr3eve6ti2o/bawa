import { useState } from 'react';
import bitcoinLogo from '../assets/chains/bitcoin.webp';
import ethereumLogo from '../assets/chains/ethereum.webp';
import tronLogo from '../assets/chains/tron.webp';
import tonLogo from '../assets/chains/ton.webp';
import solanaLogo from '../assets/chains/solana.webp';
import smartchainLogo from '../assets/chains/smartchain.webp';
import polygonLogo from '../assets/chains/polygon.webp';
import arbitrumLogo from '../assets/chains/arbitrum.webp';
import optimismLogo from '../assets/chains/optimism.webp';
import baseLogo from '../assets/chains/base.webp';
import avalanchecLogo from '../assets/chains/avalanchec.webp';
import litecoinLogo from '../assets/chains/litecoin.webp';
import dogeLogo from '../assets/chains/doge.webp';
import gnosisLogo from '../assets/chains/gnosis.webp';
import celoLogo from '../assets/chains/celo.webp';
import lineaLogo from '../assets/chains/linea.webp';
import mantleLogo from '../assets/chains/mantle.webp';
import scrollLogo from '../assets/chains/scroll.webp';
import opbnbLogo from '../assets/chains/opbnb.webp';
import metisLogo from '../assets/chains/metis.webp';
import auroraLogo from '../assets/chains/aurora.webp';
import fantomLogo from '../assets/chains/fantom.webp';
import zksyncLogo from '../assets/chains/zksync.webp';
import cronosLogo from '../assets/chains/cronos.webp';
import kavaevmLogo from '../assets/chains/kavaevm.webp';
import filecoinLogo from '../assets/chains/filecoin.webp';
import seievmLogo from '../assets/chains/seievm.webp';
import mantaLogo from '../assets/chains/manta.webp';
import sonicLogo from '../assets/chains/sonic.webp';
import hyperevmLogo from '../assets/chains/hyperevm.webp';
import monadLogo from '../assets/chains/monad.webp';
import roninLogo from '../assets/chains/ronin.webp';
import syscoinLogo from '../assets/chains/syscoin.webp';
import thetaLogo from '../assets/chains/theta.webp';
import iotexevmLogo from '../assets/chains/iotexevm.webp';
import bobaLogo from '../assets/chains/boba.webp';
import cfxevmLogo from '../assets/chains/cfxevm.webp';
import rootstockLogo from '../assets/chains/rootstock.webp';
import xdcLogo from '../assets/chains/xdc.webp';
import classicLogo from '../assets/chains/classic.webp';
import zetaevmLogo from '../assets/chains/zetaevm.webp';
import cosmosLogo from '../assets/chains/cosmos.webp';
import osmosisLogo from '../assets/chains/osmosis.webp';
import rippleLogo from '../assets/chains/ripple.webp';
import stellarLogo from '../assets/chains/stellar.webp';
import polkadotLogo from '../assets/chains/polkadot.webp';
import nearLogo from '../assets/chains/near.webp';
import aptosLogo from '../assets/chains/aptos.webp';
import tezosLogo from '../assets/chains/tezos.webp';
import algorandLogo from '../assets/chains/algorand.webp';
import hederaLogo from '../assets/chains/hedera.webp';
import nativeinjectiveLogo from '../assets/chains/nativeinjective.webp';
import seiLogo from '../assets/chains/sei.webp';
import axelarLogo from '../assets/chains/axelar.webp';
import nobleLogo from '../assets/chains/noble.webp';
import junoLogo from '../assets/chains/juno.webp';
import cardanoLogo from '../assets/chains/cardano.webp';
import kaspaLogo from '../assets/chains/kaspa.webp';
import starknetLogo from '../assets/chains/starknet.webp';
import zoraLogo from '../assets/chains/zora.webp';
import modeLogo from '../assets/chains/mode.webp';
import fraxtalLogo from '../assets/chains/fraxtal.webp';
import berachainLogo from '../assets/chains/berachain.webp';
import arbnovaLogo from '../assets/chains/arbnova.webp';
import worldchainLogo from '../assets/chains/worldchain.webp';
import unichainLogo from '../assets/chains/unichain.webp';
import inkLogo from '../assets/chains/ink.webp';
import abstractLogo from '../assets/chains/abstract.webp';
import soneiumLogo from '../assets/chains/soneium.webp';
import apechainLogo from '../assets/chains/apechain.webp';
import immutableLogo from '../assets/chains/immutable.webp';
import fuseLogo from '../assets/chains/fuse.webp';
import velasLogo from '../assets/chains/velas.webp';
import xlayerLogo from '../assets/chains/xlayer.webp';
import taikoLogo from '../assets/chains/taiko.webp';
import astarLogo from '../assets/chains/astar.webp';
import telosLogo from '../assets/chains/telos.webp';
import coreLogo from '../assets/chains/core.webp';
import songbirdLogo from '../assets/chains/songbird.webp';
import pulsechainLogo from '../assets/chains/pulsechain.webp';
import chilizLogo from '../assets/chains/chiliz.webp';
import flareLogo from '../assets/chains/flare.webp';
import hemiLogo from '../assets/chains/hemi.webp';
import bobLogo from '../assets/chains/bob.webp';
import flowevmLogo from '../assets/chains/flowevm.webp';
import celestiaLogo from '../assets/chains/celestia.webp';
import dydxLogo from '../assets/chains/dydx.webp';
import usdcLogo from '../assets/tokens/usdc.webp';
import usdtLogo from '../assets/tokens/usdt.webp';
import daiLogo from '../assets/tokens/dai.webp';
import linkLogo from '../assets/tokens/link.webp';
import uniLogo from '../assets/tokens/uni.webp';
import wbtcLogo from '../assets/tokens/wbtc.webp';
import wethLogo from '../assets/tokens/weth.webp';
import usdt0Logo from '../assets/tokens/usdt0.webp';
import { chainConfig } from '../wallet/chains';
import type { ChainId } from '../engine/boundary';

// Token logos: Trust Wallet asset registry (trustwallet/assets, MIT,
// Copyright (c) 2019-2023 Trust Wallet). Native logos are
// blockchains/<chain>/info/logo.png (same files as the chain logos);
// ERC-20 logos are blockchains/ethereum/assets/<contract>/logo.png.
// Full licence note: apps/web/README.md "Chain logos" and "Token logos".
// Served as WebP (Lane F, 2026-11-20; token discovery, 2026-11-22): the
// same Trust Wallet images, resized to 96px and re-encoded at quality
// 85 — 39,670 bytes total vs 303,787 bytes for the PNGs (-87%). The
// original PNGs stay in src/assets/chains and src/assets/tokens as the
// canonical sources. Lane G (2026-11-23) adds the nine late-registry
// chain logos and the WETH / USDT0 token logos from the same registry
// and pinned commit; WETH is blockchains/ethereum/assets/
// 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png (upstream name
// WETH) and USDT0 is blockchains/arbitrum/assets/
// 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9/logo.png (upstream name
// Tether USD, symbol USDT — the USDT0 contract on Arbitrum).
export const TOKEN_LOGOS: Record<string, string> = {
  BTC: bitcoinLogo,
  ETH: ethereumLogo,
  TRX: tronLogo,
  TON: tonLogo,
  // ERC-20 logos, displayed by the token rows (token discovery): every
  // balance shown with one comes from a real on-chain read, never a
  // fabricated value.
  USDC: usdcLogo,
  USDT: usdtLogo,
  DAI: daiLogo,
  LINK: linkLogo,
  UNI: uniLogo,
  WBTC: wbtcLogo,
  WETH: wethLogo,
  USDT0: usdt0Logo,
};

/**
 * On-chain spelling variants that have no exact symbol key (Lane G):
 * the chains report these symbols, and the lookup below maps them to
 * the logo of the token they are. 'USDt' needs no entry — uppercasing
 * already turns it into 'USDT'. Trust Wallet itself resolves by
 * contract address, not by symbol; the symbol map is this wallet's
 * simplification, and the aliases keep it honest for the spellings
 * the registry actually reports.
 */
const TOKEN_SYMBOL_ALIASES: Record<string, string> = {
  'USD₮': 'USDT',
  'USD₮0': 'USDT0',
};

/**
 * Chain logos keyed by chain id (token discovery, 2026-11-22). The three
 * ETH-symbol chains (Arbitrum One, OP Mainnet, Base) need their own
 * marks — a symbol-keyed lookup would show the Ethereum logo for all
 * three. Filenames follow the Trust Wallet directory names (solana,
 * smartchain, polygon, arbitrum, optimism, base, avalanchec, litecoin,
 * doge); BSC uses blockchains/smartchain (the BNB Smart Chain mark),
 * not blockchains/binance (the BNB Beacon Chain mark). Lane G adds the
 * nine late-registry chains (Gnosis, Celo, Linea, Mantle, Scroll,
 * opBNB, Metis, Aurora, Fantom): Gnosis is blockchains/xdai (not
 * blockchains/gnosis, which does not exist); the other eight use their
 * registry directory names. Each upstream info.json name was verified
 * at fetch time (Gnosis Chain, Celo, Linea, Mantle Chain, Scroll,
 * opBNB, Metis, Aurora, Fantom).
 * Lane 80-APP (2026-11-24) adds the thirty-four expanded-chain logos
 * from the same source and pinned commit, with directory corrections
 * where the Bawa key differs from the Trust Wallet directory: Kava is
 * blockchains/kavaevm, Sei (EVM) is blockchains/seievm while Sei
 * (Cosmos) is blockchains/sei, IoTeX is blockchains/iotexevm, Conflux
 * is blockchains/cfxevm, Ethereum Classic is blockchains/classic,
 * ZetaChain is blockchains/zetaevm, XRP is blockchains/ripple and
 * Injective is blockchains/nativeinjective. Each upstream info.json
 * name was verified at fetch time (ZkSync Era, Cronos, KavaEvm,
 * Filecoin, Sei, Manta Pacific, Sonic, HyperEVM, Monad, Ronin,
 * Syscoin, THETA, IoTeX Network Mainnet, Boba, Conflux eSpace,
 * Rootstock, XinFin Network, Ethereum Classic, ZetaChain, Cosmos,
 * Osmosis, XRP, Stellar, Polkadot, NEAR Protocol, Aptos, Tezos,
 * Algorand, Hedera, NativeInjective, Sei, Axelar, Noble, Juno).
 * Lane E (token-verify programme, 2026-11-24) adds the twenty-eight
 * chains that have no Trust Wallet Assets directory at the pin — or
 * at HEAD: their real marks come from DefiLlama chain icons (22),
 * CoinGecko coin images (5: Astar, Songbird, Velas, World Chain via
 * the Worldcoin mark, Celestia via the TIA mark) and the Tatum
 * chain-logo CDN (1: Flow EVM, SVG). Each was viewed by eye before
 * bundling; the per-chain source is recorded in
 * chains-expanded.ts (iconPath / iconUrl) and apps/web/README.md.
 * Every registry chain now has a real logo.
 */
export const CHAIN_LOGOS: Record<string, string> = {
  sol: solanaLogo,
  bsc: smartchainLogo,
  matic: polygonLogo,
  arb: arbitrumLogo,
  op: optimismLogo,
  base: baseLogo,
  avax: avalanchecLogo,
  ltc: litecoinLogo,
  doge: dogeLogo,
  gnosis: gnosisLogo,
  celo: celoLogo,
  linea: lineaLogo,
  mantle: mantleLogo,
  scroll: scrollLogo,
  opbnb: opbnbLogo,
  metis: metisLogo,
  aurora: auroraLogo,
  fantom: fantomLogo,
  zksync: zksyncLogo,
  cronos: cronosLogo,
  kava: kavaevmLogo,
  filecoin: filecoinLogo,
  sei: seievmLogo,
  manta: mantaLogo,
  sonic: sonicLogo,
  hyperevm: hyperevmLogo,
  monad: monadLogo,
  ronin: roninLogo,
  syscoin: syscoinLogo,
  theta: thetaLogo,
  iotex: iotexevmLogo,
  boba: bobaLogo,
  conflux: cfxevmLogo,
  rootstock: rootstockLogo,
  xdc: xdcLogo,
  etc: classicLogo,
  zetachain: zetaevmLogo,
  cosmos: cosmosLogo,
  osmosis: osmosisLogo,
  xrp: rippleLogo,
  stellar: stellarLogo,
  polkadot: polkadotLogo,
  near: nearLogo,
  aptos: aptosLogo,
  tezos: tezosLogo,
  algorand: algorandLogo,
  hedera: hederaLogo,
  injective: nativeinjectiveLogo,
  seicosmos: seiLogo,
  axelar: axelarLogo,
  noble: nobleLogo,
  juno: junoLogo,
  cardano: cardanoLogo,
  kaspa: kaspaLogo,
  starknet: starknetLogo,
  zora: zoraLogo,
  mode: modeLogo,
  fraxtal: fraxtalLogo,
  berachain: berachainLogo,
  arbnova: arbnovaLogo,
  worldchain: worldchainLogo,
  unichain: unichainLogo,
  ink: inkLogo,
  abstract: abstractLogo,
  soneium: soneiumLogo,
  apechain: apechainLogo,
  immutable: immutableLogo,
  fuse: fuseLogo,
  velas: velasLogo,
  xlayer: xlayerLogo,
  taiko: taikoLogo,
  astar: astarLogo,
  telos: telosLogo,
  core: coreLogo,
  songbird: songbirdLogo,
  pulsechain: pulsechainLogo,
  chiliz: chilizLogo,
  flare: flareLogo,
  hemi: hemiLogo,
  bob: bobLogo,
  flowevm: flowevmLogo,
  celestia: celestiaLogo,
  dydx: dydxLogo,
};

export function chainLogoFor(chain: string): string | undefined {
  return CHAIN_LOGOS[chain];
}

export function tokenLogoFor(symbol: string): string | undefined {
  const key = symbol.trim().toUpperCase();
  return TOKEN_LOGOS[TOKEN_SYMBOL_ALIASES[key] ?? key];
}

/**
 * Native chain logo (40px default), rendered through TokenLogo so the
 * asset rows, asset detail, chain strip and receive/send pickers all
 * share one logo path: a real logo when registered, the deliberate
 * link mark otherwise (Lane E). Chain-keyed: Arbitrum, OP Mainnet
 * and Base have their own marks — a symbol-keyed lookup would show the
 * Ethereum logo for all three. (Moved here from asset-rows, Lane G, so
 * the strip and pickers can use it without importing the rows module.)
 * A logo that fails to load falls back to the deliberate link mark
 * (Lane E), never a broken image and never a ticker-letter chip.
 *
 * Lane B (token-verify, 2026-11-24): the symbol-logo fallback below
 * applies ONLY to the four chains whose native token logo IS the
 * chain's mark (BTC, ETH, TRX, TON — they have no chain-keyed entry).
 * Every other chain without a chain logo gets the link mark: the
 * old fallback showed the Ethereum logo on the eleven icon-less
 * ETH-symbol chains (Zora, Mode, Arbitrum Nova, World Chain,
 * Unichain, Ink, Abstract, Soneium, Taiko, Hemi, BOB) — the wrong
 * network mark, the same defect Lane G fixed for Arbitrum/OP/Base.
 * (Lane E wired real logos for all 28, so this path now fires only
 * when a logo fails to load or for a chain added later without one.)
 */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
  const [failed, setFailed] = useState(false);
  const logo = chainLogoFor(chain);
  const style = size === 40 ? undefined : { width: size, height: size };
  if (logo !== undefined && !failed) {
    return (
      <img
        src={logo}
        alt={`${chainConfig(chain).displayName} logo`}
        width={size}
        height={size}
        decoding="async"
        className="size-10 shrink-0 rounded-full"
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }
  if (chain === 'btc' || chain === 'eth' || chain === 'trx' || chain === 'ton') {
    return <TokenLogo symbol={chainConfig(chain).symbol} size={size} />;
  }
  return <FallbackMark label={`${chainConfig(chain).displayName} logo unavailable`} size={size} />;
}

/**
 * The deliberate fallback mark (Lane E, shared — merge 2026-11-24):
 * a paper disc with a full-opacity ink ring and a centred chain-link
 * mark in ink. Shared by TokenLogo, ChainLogo and the QR card's
 * LogoImage so the three can never drift apart again (the rule Lane B
 * set for the empty ring, now carried by Lane E's mark). No yellow,
 * no ticker text, no faded ring.
 */
export function FallbackMark({
  label,
  size = 40,
  className = '',
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  const style = size === 40 ? undefined : { width: size, height: size };
  return (
    <span
      role="img"
      aria-label={label}
      className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-paper ${className}`}
      style={style}
    >
      <svg
        viewBox="0 0 24 24"
        width="55%"
        height="55%"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="text-ink"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    </span>
  );
}

type TokenLogoProps = {
  symbol: string;
  size?: number;
  /**
   * Lane A: the token's resolved icon URL (recorded at add time —
   * Trust Wallet Assets, CoinGecko image, or the verifying list's
   * logoURI). It wins over the bundled symbol logo: a custom token
   * that merely shares a symbol with a known token must not wear
   * that token's logo.
   */
  iconUrl?: string | null;
  /**
   * Lane A: whether the bundled symbol-keyed logo may be shown.
   * True for the curated defaults (their symbol IS their identity);
   * false for user-added tokens, where a shared symbol must not
   * borrow the real token's mark. Defaults to true so existing
   * call sites keep their behaviour until they thread the record
   * through.
   */
  allowSymbolLogo?: boolean;
};

/**
 * Token logo (40px default). A missing logo — or one that fails to load —
 * renders the wallet's deliberate fallback: a paper disc with an ink
 * ring and a centred chain-link mark (Lane E, 2026-11-24). It is
 * clearly intentional — not a broken image, not a yellow text square
 * (the yellow ticker badge read as a broken logo, owner 2026-11-23),
 * and not a bare ticker: the symbol is already shown as text beside
 * the logo, so nothing is lost. Every registry chain now has a real
 * logo, so this mark only shows when a logo fails to load or for a
 * chain added later without one.
 *
 * Lane A: when a resolved iconUrl is set it is tried first; a failed
 * remote icon falls back to the bundled symbol logo only when
 * allowSymbolLogo is set, and to the link mark otherwise.
 */
export function TokenLogo({ symbol, size = 40, iconUrl, allowSymbolLogo = true }: TokenLogoProps) {
  const [iconFailed, setIconFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = tokenLogoFor(symbol);
  const style = size === 40 ? undefined : { width: size, height: size };

  if (iconUrl !== null && iconUrl !== undefined && !iconFailed) {
    return (
      <img
        src={iconUrl}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        decoding="async"
        className="size-10 shrink-0 rounded-full"
        style={style}
        onError={() => setIconFailed(true)}
      />
    );
  }

  if (allowSymbolLogo && logo && !logoFailed) {
    return (
      <img
        src={logo}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        decoding="async"
        className="size-10 shrink-0 rounded-full"
        style={style}
        onError={() => setLogoFailed(true)}
      />
    );
  }

  // Merge (2026-11-24): Lane E's deliberate fallback — a paper disc,
  // full-opacity ink ring, and a centred chain-link mark in ink. It
  // reads as the wallet's own generic mark, not a missing image: no
  // yellow, no ticker text, no faded ring. It replaces Lane B's empty
  // ring as the shared fallback (same rule: never the bundled logo of
  // a different token with the same symbol).
  return <FallbackMark label={`${symbol} logo unavailable`} size={size} />;
}
