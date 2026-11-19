```typescript
const CHAIN_LOGOS: Partial<Record<ChainId, string>> = {
  btc: bitcoinLogo,
  eth: ethereumLogo,
  trx: tronLogo,
  ton: tonLogo,
};

/**
 * Native chain logo (40px default). Decorative: the chain name is adjacent text, so alt is empty.
 * Chains without a logo file yet show the symbol initial.
 */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
  const logo = CHAIN_LOGOS[chain];

  if (!logo) {
    return (
      <span
        aria-hidden="true"
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"
        style={size !== 40 ? { width: size, height: size } : undefined}
      >
        {chainConfig(chain).symbol.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={CHAIN_LOGOS[chain]}
      alt=""
      width={size}
      height={size}
      className="size-10 shrink-0 rounded-full"
      style={size !== 40 ? { width: size, height: size } : undefined}
    />
  );
}
```