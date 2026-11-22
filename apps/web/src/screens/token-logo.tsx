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
import usdcLogo from '../assets/tokens/usdc.webp';
import usdtLogo from '../assets/tokens/usdt.webp';
import daiLogo from '../assets/tokens/dai.webp';
import linkLogo from '../assets/tokens/link.webp';
import uniLogo from '../assets/tokens/uni.webp';
import wbtcLogo from '../assets/tokens/wbtc.webp';

// Token logos: Trust Wallet asset registry (trustwallet/assets, MIT,
// Copyright (c) 2019-2023 Trust Wallet). Native logos are
// blockchains/<chain>/info/logo.png (same files as the chain logos);
// ERC-20 logos are blockchains/ethereum/assets/<contract>/logo.png.
// Full licence note: apps/web/README.md "Chain logos" and "Token logos".
// Served as WebP (Lane F, 2026-11-20; token discovery, 2026-11-22): the
// same Trust Wallet images, resized to 96px and re-encoded at quality
// 85 — 39,670 bytes total vs 303,787 bytes for the PNGs (-87%). The
// original PNGs stay in src/assets/chains and src/assets/tokens as the
// canonical sources.
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
};

/**
 * Chain logos keyed by chain id (token discovery, 2026-11-22). The three
 * ETH-symbol chains (Arbitrum One, OP Mainnet, Base) need their own
 * marks — a symbol-keyed lookup would show the Ethereum logo for all
 * three. Filenames follow the Trust Wallet directory names (solana,
 * smartchain, polygon, arbitrum, optimism, base, avalanchec, litecoin,
 * doge); BSC uses blockchains/smartchain (the BNB Smart Chain mark),
 * not blockchains/binance (the BNB Beacon Chain mark).
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
};

export function chainLogoFor(chain: string): string | undefined {
  return CHAIN_LOGOS[chain];
}

export function tokenLogoFor(symbol: string): string | undefined {
  return TOKEN_LOGOS[symbol.toUpperCase()];
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

  return (
    <span
      role="img"
      aria-label={`${symbol} logo unavailable`}
      className="flex size-10 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink bg-sun text-[11px] font-bold uppercase text-ink"
      style={style}
    >
      {symbol.trim().toUpperCase().slice(0, 4) || '?'}
    </span>
  );
}
