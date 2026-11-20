import { useState } from 'react';
import bitcoinLogo from '../assets/chains/bitcoin.webp';
import ethereumLogo from '../assets/chains/ethereum.webp';
import tronLogo from '../assets/chains/tron.webp';
import tonLogo from '../assets/chains/ton.webp';
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
// Served as WebP (Lane F, 2026-11-20): the same Trust Wallet images,
// resized to 96px and re-encoded at quality 85 — 23,378 bytes total vs
// 167,628 bytes for the PNGs (-86%). The original PNGs stay in
// src/assets/chains and src/assets/tokens as the canonical sources.
export const TOKEN_LOGOS: Record<string, string> = {
  BTC: bitcoinLogo,
  ETH: ethereumLogo,
  TRX: tronLogo,
  TON: tonLogo,
  // ERC-20 logos are registered for future token adapters. No balance adapter
  // lists them yet, so they are not displayed in asset rows today and must
  // never be shown with a fabricated balance.
  USDC: usdcLogo,
  USDT: usdtLogo,
  DAI: daiLogo,
  LINK: linkLogo,
  UNI: uniLogo,
  WBTC: wbtcLogo,
};

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
