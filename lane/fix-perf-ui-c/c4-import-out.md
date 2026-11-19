1. Old:
   > ```tsx
   >   const [mode, setMode] = useState<ImportMode>('watch-only');
   > ```

   ```tsx
     const [mode, setMode] = useState<ImportMode>('phrase');
   ```

2. Add import:
   ```tsx
   import { Tabs, TabsList, TabsTrigger } from '../ui/components/tabs';
   ```

   Old:
   > ```tsx
   >           <div className="flex gap-2" role="tablist" aria-label="Import mode">
   >             <Button
   >               type="button"
   >               role="tab"
   >               aria-selected={mode === 'phrase'}
   >               variant={mode === 'phrase' ? 'default' : 'outline'}
   >               onClick={() => setMode('phrase')}
   >             >
   >               Recovery phrase
   >             </Button>
   >             <Button
   >               type="button"
   >               role="tab"
   >               aria-selected={mode === 'watch-only'}
   >               variant={mode === 'watch-only' ? 'default' : 'outline'}
   >               onClick={() => setMode('watch-only')}
   >             >
   >               Watch-only public key
   >             </Button>
   >           </div>
   > ```

   ```tsx
             <Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)}>
               <TabsList aria-label="Import mode">
                 <TabsTrigger value="phrase">Restore full wallet</TabsTrigger>
                 <TabsTrigger value="watch-only">Watch-only</TabsTrigger>
               </TabsList>
             </Tabs>
   ```

3. Old:
   > ```tsx
   > <p id="watch-only-notice" className="text-sm leading-relaxed text-muted-foreground">
   > ```

   ```tsx
   <Alert>
     <AlertDescription>
       Watch-only accounts cannot sign transactions. Import one chain at a time.
     </AlertDescription>
   </Alert>
   <p id="watch-only-notice" className="text-sm leading-relaxed text-muted-foreground">
   ```

4. Old:
   > ```tsx
   >             </ul>
   >             <form className="space-y-4" noValidate onSubmit={(event) => void handleSaveSubmit(event)}>
   > ```

   ```tsx
               </ul>
               <Button
                 type="button"
                 variant="outline"
                 onClick={() => {
                   setPhraseStep('enter');
                   setDerived(null);
                   setNormalizedMnemonic(null);
                 }}
               >
                 Edit recovery phrase
               </Button>
               <form className="space-y-4" noValidate onSubmit={(event) => void handleSaveSubmit(event)}>
   ```

5. **(a)** Every matching Card; count cannot be verified from the supplied excerpts.

   Old: `Card className="rounded-[20px] border-[#d6deed]"`

   ```tsx
   Card className="rounded-xl"
   ```

   **(b)** Old:
   > ```tsx
   >                     className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff] ${
   >                       chain === option
   >                         ? 'bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] text-white'
   >                         : 'border border-border bg-card text-muted-foreground hover:text-foreground'
   >                     }`}
   > ```

   ```tsx
                       className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                         chain === option
                           ? 'bg-primary text-primary-foreground'
                           : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                       }`}
   ```

   **(c)** Old: `className="space-y-2 rounded-[15px] border border-[#d6deed] bg-white p-4 text-[#1b2742]"`

   ```tsx
   className="space-y-2 rounded-xl border bg-card p-4 text-foreground"
   ```

   **(d)** Old: `'Enter a 12-word or 24-word recovery phrase.'`

   ```tsx
   'Enter a 12- or 24-word recovery phrase.'
   ```