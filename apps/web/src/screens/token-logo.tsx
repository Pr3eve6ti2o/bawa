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
 * share one logo path: a real Trust Wallet logo when registered, a
 * readable ticker badge otherwise. Chain-keyed: Arbitrum, OP Mainnet
 * and Base have their own marks — a symbol-keyed lookup would show the
 * Ethereum logo for all three. (Moved here from asset-rows, Lane G, so
 * the strip and pickers can use it without importing the rows module.)
 * A logo that fails to load falls back to the ticker badge, never a
 * broken image.
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
  return <TokenLogo symbol={chainConfig(chain).symbol} size={size} />;
}

type TokenLogoProps = {
  symbol: string;
  size?: number;
};

/**
 * Token logo (40px default). A missing logo — or one that fails to load —
 * renders a readable badge with the ticker text, never a broken image and
 * never an empty box.
 */
export function TokenLogo({ symbol, size = 40 }: TokenLogoProps) {
  const [failed, setFailed] = useState(false);
  const logo = tokenLogoFor(symbol);
  const style = size === 40 ? undefined : { width: size, height: size };

  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt={`${symbol} logo`}
        width={size}
        height={size}
        decoding="async"
        className="size-10 shrink-0 rounded-full"
        style={style}
        onError={() => setFailed(true)}
      />
    );
  }

  // Small sizes (the 24px receive/send picker icons) get smaller badge
  // text so a four-letter ticker still fits inside the box.
  const badgeTextClass = size <= 24 ? 'text-[9px]' : 'text-[11px]';
  return (
    <span
      role="img"
      aria-label={`${symbol} logo unavailable`}
      className={`flex size-10 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun ${badgeTextClass} font-bold uppercase text-ink`}
      style={style}
    >
      {symbol.trim().toUpperCase().slice(0, 4) || '?'}
    </span>
  );
}
