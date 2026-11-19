1. `apps/web/src/screens/asset-list.tsx`

   > ```tsx
   > import { useState } from 'react';
   > import { useWallet } from '../state/wallet-context';
   > import { Button } from '../ui/components/button';
   > import { AssetRows } from './asset-rows';
   >
   > /**
   >  * Full asset list — the same real-balance rows as the dashboard. No fiat
   >  * total exists (no price feed), so none is shown or fabricated.
   >  */
   > export function AssetListScreen() {
   >   const { refreshBalances } = useWallet();
   >   const [hideZero, setHideZero] = useState(false);
   >
   >   return (
   >     <div className="space-y-6">
   >       <h1 className="text-2xl font-bold text-white">Assets</h1>
   >
   >       <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-[#243454] px-5 py-4 text-white">
   >         <div>
   >           <p className="text-xs text-[#aab5d1]">Portfolio balance</p>
   >           <p className="text-2xl font-bold">Unavailable</p>
   >           <p className="text-xs text-[#aab5d1]">
   >             No price feed connected — exact native balances below.
   >           </p>
   >         </div>
   >         <div className="flex items-center gap-3">
   >           <Button
   >             type="button"
   >             variant="outline"
   >             onClick={() => void refreshBalances()}
   >           >
   >             Refresh
   >           </Button>
   >           <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
   >             <input
   >               type="checkbox"
   >               checked={hideZero}
   >               onChange={(event) => setHideZero(event.target.checked)}
   >             />
   >             Hide zero balances
   >           </label>
   >         </div>
   >       </div>
   >
   >       <AssetRows hideZero={hideZero} />
   >     </div>
   >   );
   > }
   > ```

   ```tsx
   import { useState } from 'react';
   import { Button } from '../ui/components/button';
   import { Card } from '../ui/components/card';
   import { AssetRows } from './asset-rows';

   /**
    * Full asset list — the same real-balance rows as the dashboard. No fiat
    * total exists (no price feed), so none is shown or fabricated.
    */
   export function AssetListScreen() {
     const [hideZero, setHideZero] = useState(false);

     return (
       <div className="space-y-6">
         <div className="flex items-center justify-between gap-3">
           <h1 className="text-2xl font-semibold text-panel-text">Assets</h1>
           <Button
             type="button"
             aria-pressed={hideZero}
             onClick={() => setHideZero((current) => !current)}
             variant={hideZero ? 'default' : 'outline'}
             className="h-11 shrink-0 rounded-[22px] px-3 text-sm font-medium"
           >
             Hide zero balances
           </Button>
         </div>

         <Card>
           <AssetRows hideZero={hideZero} onShowAll={() => setHideZero(false)} />
         </Card>
       </div>
     );
   }
   ```

2. `apps/web/src/screens/asset-detail.tsx`

   **Imports**

   > `import { CHAIN_CHIP_COLORS } from './asset-rows';`

   ```tsx
   import { ChainLogo } from './asset-rows';
   import { ArrowLeft } from 'lucide-react';
   ```

   **Header**

   > ```tsx
   >       <header className="flex flex-wrap items-center justify-between gap-4">
   >         <h1 className="flex items-center gap-3 text-2xl font-semibold">
   >           <span
   >             className="flex size-10 items-center justify-center rounded-full text-base font-bold text-[#19223a]"
   >             style={{ backgroundColor: CHAIN_CHIP_COLORS[chain] ?? '#9daeff' }}
   >           >
   >             {config.displayName.slice(0, 1)}
   >           </span>
   >           {config.displayName}
   >         </h1>
   >         <div className="flex gap-2">
   >           <Button
   >             type="button"
   >             variant="outline"
   >             disabled={state === 'loading'}
   >             onClick={refreshAll}
   >           >
   >             Refresh
   >           </Button>
   >           <Button asChild>
   >             <Link to="/receive" onClick={() => setSelectedChain(chain)}>
   >               Receive
   >             </Link>
   >           </Button>
   >         </div>
   >       </header>
   > ```

   ```tsx
         <Link
           to="/assets"
           aria-label="Back to assets"
           className="flex h-11 w-11 items-center justify-center rounded-full text-panel-text hover:bg-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-panel-accent"
         >
           <ArrowLeft className="size-5" aria-hidden="true" />
         </Link>
   ```

   **Transaction-row link**

   > `focus-visible:ring-[#b4aaff]`

   ```tsx
   focus-visible:ring-panel-accent
   ```

   **Xpub Card only**

   > `className="rounded-[20px] border-[#d6deed]"`

   ```tsx
   className="rounded-xl"
   ```