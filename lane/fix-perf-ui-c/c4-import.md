Make five targeted edits to apps/web/src/screens/import-wallet.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only. Change NO logic, NO handlers, NO validation, NO copy except where the spec gives new copy below. Spec is UI-UX-REFERENCE.md §4 (MetaMask restore-first hierarchy; Rabby watch-only labelling).

EDIT 1 — Restore is the default mode. Exact current line:
```tsx
  const [mode, setMode] = useState<ImportMode>('watch-only');
```
Change `'watch-only'` to `'phrase'`. Nothing else on that line.

EDIT 2 — Replace the mode switch with the labelled Tabs component. Exact current code:
```tsx
          <div className="flex gap-2" role="tablist" aria-label="Import mode">
            <Button
              type="button"
              role="tab"
              aria-selected={mode === 'phrase'}
              variant={mode === 'phrase' ? 'default' : 'outline'}
              onClick={() => setMode('phrase')}
            >
              Recovery phrase
            </Button>
            <Button
              type="button"
              role="tab"
              aria-selected={mode === 'watch-only'}
              variant={mode === 'watch-only' ? 'default' : 'outline'}
              onClick={() => setMode('watch-only')}
            >
              Watch-only public key
            </Button>
          </div>
```
Replace with the `Tabs` component from `../ui/components/tabs` (`Tabs`, `TabsList`, `TabsTrigger`; add the import, remove no other imports). `Tabs value={mode} onValueChange={(value) => setMode(value as ImportMode)}`, `TabsList` with `aria-label="Import mode"`, two `TabsTrigger`s with values `phrase` and `watch-only` labelled exactly "Restore full wallet" and "Watch-only". No `TabsContent` — the forms below stay conditionally rendered as they are. The Tabs component already carries the spec geometry (container h-9, rounded-xl, p-1; tab text-sm medium).

EDIT 3 — Persistent watch-only warning. At the start of the watch-only branch, directly before the existing paragraph `<p id="watch-only-notice" className="text-sm leading-relaxed text-muted-foreground">`, insert an `Alert` (already imported) with `AlertDescription` containing exactly: "Watch-only accounts cannot sign transactions. Import one chain at a time." Keep the existing notice paragraph unchanged below it.

EDIT 4 — Edit control on the preview step. In the preview Card (phraseStep === 'preview'), directly after the derived-addresses `<ul>` and before the save `<form className="space-y-4" noValidate onSubmit={(event) => void handleSaveSubmit(event)}>`, insert an outline Button labelled "Edit recovery phrase" with onClick that returns to phrase entry and invalidates the preview:
```tsx
onClick={() => {
  setPhraseStep('enter');
  setDerived(null);
  setNormalizedMnemonic(null);
}}
```
Exact anchor lines for the insertion point:
```tsx
            </ul>
            <form className="space-y-4" noValidate onSubmit={(event) => void handleSaveSubmit(event)}>
```

EDIT 5 — Re-skin + one copy fix (no logic):
(a) Every `Card className="rounded-[20px] border-[#d6deed]"` in this file becomes `Card className="rounded-xl"` (drop the hardcoded border override so the Card's own border token applies in both themes; rounded-xl is the §1.2 Card radius). List the count of Cards you changed.
(b) Chain pill buttons (watch-only chain choice): selected pill becomes solid primary — `bg-primary text-primary-foreground` — and unselected becomes `border border-border bg-card text-muted-foreground hover:text-foreground`. The focus ring becomes `focus-visible:ring-ring` (spec focus token). Current code:
```tsx
                    className={`h-10 rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b4aaff] ${
                      chain === option
                        ? 'bg-gradient-to-r from-[#8b7cff] to-[#4f7cff] text-white'
                        : 'border border-border bg-card text-muted-foreground hover:text-foreground'
                    }`}
```
(c) The imported-wallet list item `className="space-y-2 rounded-[15px] border border-[#d6deed] bg-white p-4 text-[#1b2742]"` becomes `className="space-y-2 rounded-xl border bg-card p-4 text-foreground"`.
(d) The word-count error string `'Enter a 12-word or 24-word recovery phrase.'` becomes `'Enter a 12- or 24-word recovery phrase.'` (spec §4 copy). Change ONLY that string literal.

Acceptance: mode defaults to `'phrase'`; Tabs labels are exactly "Restore full wallet" / "Watch-only"; the warning Alert copy is exact; the Edit button invalidates derived + normalizedMnemonic and returns to 'enter'; no `#` hex, no `white/`, no `slate-*`, no gradient classes remain in the file; `tsc`-clean (all imports used — note `Button` is still used elsewhere in the file).

Return ONLY the five edits, numbered 1-5, each with the exact old text quoted and the replacement in its own ```tsx fenced block. No explanation, no other changes.
