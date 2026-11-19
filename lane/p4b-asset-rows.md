You are writing TypeScript for the Bawa wallet repo (strict TS, React). File: apps/web/src/screens/asset-rows.tsx. ChainId now has 13 chains but logo files exist only for the 4 originals. Change ONLY the two declarations below — keep the img branch byte-for-byte identical when a logo exists. Emit ONLY the replacement code in one fenced typescript block.

Current code (verbatim, do not alter the img branch):
```tsx
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
The file already imports chainConfig from '../wallet/chains'. Do NOT add logo imports or paths (the token-logos lane owns logos).

Change: CHAIN_LOGOS becomes Partial<Record<ChainId, string>> with the same 4 entries. ChainLogo: look up the logo; if present, return the img exactly as above; if absent, return a span badge showing the first letter of chainConfig(chain).symbol, with the same width/height (size prop, default 40), rounded-full, muted background, centred text, aria-hidden true. Add one line to the doc comment noting chains without a logo file yet show the symbol initial.

Acceptance: strict TS compiles; the img branch is unchanged for the 4 logo chains. Output only the code block, no other prose.
