1. `apps/web/src/screens/asset-rows.tsx` — insert after the existing imports.

Old: `""`

Replacement:
```tsx
import type { ChainId } from '../engine/boundary';

// Chain logos: Trust Wallet asset registry (trustwallet/assets, MIT,
// Copyright (c) 2019-2023 Trust Wallet) — blockchains/<chain>/info/logo.png.
// Full licence note: apps/web/README.md "Chain logos".
import bitcoinLogo from '../assets/chains/bitcoin.png';
import ethereumLogo from '../assets/chains/ethereum.png';
import tronLogo from '../assets/chains/tron.png';
import tonLogo from '../assets/chains/ton.png';

const CHAIN_LOGOS: Record<ChainId, string> = {
  btc: bitcoinLogo,
  eth: ethereumLogo,
  trx: tronLogo,
  ton: tonLogo,
};

/** Native chain logo (40px default). Decorative: the chain name is adjacent text, so alt is empty. */
export function ChainLogo({ chain, size = 40 }: { chain: ChainId; size?: number }) {
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

2. `apps/web/src/screens/asset-rows.tsx`

Old:
> ```tsx
>         const avatar = (
>           <span className="relative flex size-10 shrink-0 items-center justify-center">
>             <span
>               className="flex size-10 items-center justify-center rounded-full text-[11px] font-bold text-[#19223a]"
>               style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
>             >
>               {config.symbol}
>             </span>
>             <span className="absolute -bottom-1 -right-1 flex h-4 items-center rounded-full bg-[#293654] px-1 text-[8px] font-bold text-[#c8d0e8] ring-1 ring-[#19223a]">
>               {config.symbol}
>             </span>
>           </span>
>         );
> ```

Replacement:
```tsx
        const avatar = <ChainLogo chain={chain} />;
```

3. `apps/web/src/screens/asset-rows.tsx`

Old: `export function AssetRows({ hideZero }: { hideZero: boolean }) {`

Replacement:
```tsx
export function AssetRows({ hideZero, onShowAll }: { hideZero: boolean; onShowAll?: () => void }) {
```

Old:
> ```tsx
>     return <p className="text-sm text-[#aab5d1]">No balance adapters verified yet.</p>;
> ```

Replacement:
```tsx
    return <p className="p-4 text-sm text-muted-foreground">No balance adapters verified yet.</p>;
```

Old:
> ```tsx
>     return (
>       <p className="text-sm text-[#aab5d1]">
>         All balances are zero — turn off “Hide zero balances” to see them.
>       </p>
>     );
> ```

Replacement:
```tsx
    if (hideZero) {
      return (
        <div className="space-y-2 p-4">
          <p className="text-sm text-muted-foreground">No non-zero balances</p>
          <Button type="button" variant="outline" onClick={() => onShowAll?.()}>
            Show all
          </Button>
        </div>
      );
    }

    return (
      <p className="p-4 text-sm text-muted-foreground">
        All balances are zero — turn off “Hide zero balances” to see them.
      </p>
    );
```

Old:
> ```tsx
>   return (
>     <ul className="divide-y divide-white/10">
> ```

Replacement:
```tsx
  return (
    <ul className="divide-y divide-border">
```

Old: `<li key={chain} className="flex items-center gap-3 py-4">`

Replacement:
```tsx
<li key={chain} className="flex items-center gap-3 px-4 py-3">
```

Old: `className="text-[15px] font-bold text-[#eff2fc]"`

Replacement:
```tsx
className="text-[15px] font-bold text-foreground"
```

Old: `className="text-xs text-[#9da9c7]"`

Replacement:
```tsx
className="text-xs text-muted-foreground"
```

Old:
> ```tsx
>               <AssetRow
>                 avatar={avatar}
>                 symbol={config.displayName}
>                 amount={`${config.symbol} · ${config.displayName} mainnet`}
>                 value={value}
>                 detail={balance.status === 'zero' ? 'Zero balance' : undefined}
>               />
> ```

Replacement:
```tsx
              <AssetRow
                avatar={avatar}
                symbol={config.symbol}
                amount={balance.status === 'zero' ? 'Zero balance' : value}
                detail={`${config.displayName} mainnet`}
              />
```

4. `apps/web/src/ui/components/asset-row.tsx`

Old:
> ```tsx
> interface AssetRowProps extends React.ComponentProps<'div'> {
>   avatar: ReactNode
>   symbol: string
>   amount: string
>   value: string
>   detail?: string
>   detailColor?: string
> }
> ```

Replacement:
```tsx
interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value?: string
  detail?: string
  detailColor?: string
}
```

Old: `'flex items-center justify-between rounded-lg px-3 py-3'`

Replacement:
```tsx
'flex min-h-[68px] items-center justify-between rounded-lg px-4 py-3'
```

Old:
> ```tsx
>       <div className="text-right">
>         <div className="text-base font-semibold">{value}</div>
>         {detail ? (
>           <div
>             data-design-audit-allow="dynamic-token-color"
>             className="text-sm font-medium"
>             style={detailColor ? { color: detailColor } : undefined}
>           >
>             {detail}
>           </div>
>         ) : null}
>       </div>
> ```

Replacement:
```tsx
      {(value || detail) && (
        <div className="text-right">
          {value ? <div className="text-base font-semibold">{value}</div> : null}
          {detail ? (
            <div
              data-design-audit-allow="dynamic-token-color"
              className="text-xs"
              style={detailColor ? { color: detailColor } : undefined}
            >
              {detail}
            </div>
          ) : null}
        </div>
      )}
```

5. `apps/web/src/screens/dashboard.tsx`

Old:
> ```tsx
>             <AssetRows hideZero={hideZero} />
> ```

Replacement:
```tsx
            <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} />
```