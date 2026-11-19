1. **Tokens/Activity tablist**

   > ```tsx
   >       <div
   >         role="tablist"
   >         aria-label="Wallet views"
   >         className="mb-4 flex w-fit gap-1 rounded-xl border border-[#263454] bg-[#0b1326] p-1"
   >       >
   > ```

   ```tsx
         <div
           role="tablist"
           aria-label="Wallet views"
           className="mb-4 flex w-fit gap-1 rounded-xl border border-panel-border bg-panel-surface p-1"
         >
   ```

   > ```tsx
   >             className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8daeff] ${
   >               assetsTab === tab
   >                 ? 'bg-[#1a2948] text-white'
   >                 : 'text-[#c8d0e8] hover:bg-[#14213b] hover:text-white'
   >             }`}
   > ```

   ```tsx
               className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-panel-accent ${
                 assetsTab === tab
                   ? 'bg-panel-active text-panel-text'
                   : 'text-panel-text-soft hover:bg-panel-hover hover:text-panel-text'
               }`}
   ```

2. **Filter chip and Assets heading**

   > ```tsx
   >               <label className="flex items-center gap-2 text-xs font-semibold text-[#c8d0e8]">
   >                 <input
   >                   type="checkbox"
   >                   checked={hideZero}
   >                   onChange={(event) => setHideZero(event.target.checked)}
   >                 />
   >                 Hide zero balances
   >               </label>
   > ```

   ```tsx
                 <Button
                   type="button"
                   aria-pressed={hideZero}
                   onClick={() => setHideZero((current) => !current)}
                   variant={hideZero ? 'default' : 'outline'}
                   className="h-11 shrink-0 rounded-[22px] px-3 text-sm font-medium"
                 >
                   Hide zero balances
                 </Button>
   ```

   > `className="text-lg font-bold text-white"`

   ```tsx
   className="text-lg font-semibold text-panel-text"
   ```

3. **Activity panel**

   > `<ul className="divide-y divide-[#263454] overflow-hidden rounded-xl border border-[#263454] bg-[#0b1326]">`

   ```tsx
   <ul className="divide-y divide-panel-border overflow-hidden rounded-xl border border-panel-border bg-panel-surface">
   ```

   > `className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-[#14213b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#8daeff]"`

   ```tsx
   className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-panel-accent"
   ```

   Direction line:
   > `text-white`

   ```tsx
   text-panel-text
   ```

   Symbol suffix:
   > `text-[#c8d0e8]`

   ```tsx
   text-panel-text-soft
   ```

   Date line:
   > `text-xs text-[#a5b2d3]`

   ```tsx
   text-xs text-panel-text-muted
   ```

   Amount:
   > `text-sm font-semibold text-white`

   ```tsx
   text-sm font-semibold text-panel-text
   ```

   > `<Skeleton className="h-20 w-full rounded-xl bg-[#14213b]" />`

   ```tsx
   <Skeleton className="h-20 w-full rounded-xl" />
   ```

   > `<p className="rounded-xl border border-[#263454] bg-[#0b1326] p-4 text-sm text-[#c8d0e8]">No transactions yet</p>`

   ```tsx
   <p className="rounded-xl border border-panel-border bg-panel-surface p-4 text-sm text-panel-text-soft">No activity yet</p>
   ```

   > ``<div key={`history-unavailable:${chain}`} className="flex items-center justify-between gap-3 rounded-xl border border-[#263454] bg-[#0b1326] px-4 py-3">``

   ```tsx
   <div key={`history-unavailable:${chain}`} className="flex items-center justify-between gap-3 rounded-xl border border-panel-border bg-panel-surface px-4 py-3">
   ```

   > `className="text-sm text-[#c8d0e8]"`

   ```tsx
   className="text-sm text-panel-text-soft"
   ```

   > ```tsx
   >                       <Button
   >                         type="button"
   >                         onClick={() => void refreshHistory()}
   >                         className="shrink-0 rounded-lg border border-[#334767] bg-[#1a2948] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#223658]"
   >                       >
   >                         Retry
   >                       </Button>
   > ```

   ```tsx
                         <Button
                           type="button"
                           variant="outline"
                           onClick={() => void refreshHistory()}
                           className="h-11 shrink-0"
                         >
                           Retry
                         </Button>
   ```

4. **Tokens Card**

   > ```tsx
   >             <AssetRows hideZero={hideZero} />
   > ```

   ```tsx
               <Card className="mt-4">
                 <AssetRows hideZero={hideZero} />
               </Card>
   ```

   Add import:
   ```tsx
   import { Card } from '../ui/components/card';
   ```