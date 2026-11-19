Make two targeted edits to apps/web/src/screens/create-wallet.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only. Change NO logic, NO handlers, NO copy except the new progress label text given below. Do NOT touch the vault-exists Card, the password form, the confirm form, or the success card.

Context: the screen already has a 4-step StepCard list (steps 1-4, state variable `step`, type `Step = 1 | 2 | 3 | 4`) and a 24-word grid. Spec is UI-UX-REFERENCE.md §3 (our own 4-step StepCard flow; MetaMask password-entry reference only).

EDIT 1 — Add a four-step progress indicator ABOVE the StepCard list, inside the same Card, directly before `<ol aria-label="Wallet creation steps" className="space-y-5">`. Exact current code around the insertion point:
```tsx
        <CardContent>
          <ol aria-label="Wallet creation steps" className="space-y-5">
```
Return a replacement for those two lines plus the new indicator between them. The indicator:
- An ordered list with `aria-label="Creation progress"`, horizontal flex, items centred, each step a 40px numbered circle joined to the next by a track (a flex-1 2px bar using the progress-track token: `bg-progress-track`).
- Circle states reuse the StepCard circle styling: done steps use the success background with a check mark (use the `Check` icon from lucide-react — add the import if needed; the file does not import it yet); the current step uses the primary background with `text-primary-foreground` bold number; todo steps use `bg-surface-blue-dim` with primary text.
- Below (or beside) the circles, a text line naming the current step, e.g. `Step 2 of 4: Write down 24 words` — progress is never communicated through colour alone. Step labels: 1 "Set a vault password", 2 "Write down 24 words", 3 "Confirm 3 words", 4 "Wallet ready". Derive the label from the existing `step` state. The current-step text uses the foreground token; keep it visible on the light Card in both themes.
- The circles and track use ONLY token classes (no `#hex`, no `white/`, no `slate-*`).

EDIT 2 — Fix the 24-word write-down grid. Exact current code:
```tsx
            <ol aria-label="Recovery phrase" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {words.map((word, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-semibold text-muted-foreground">{index + 1}.</span>
                  <span>{word}</span>
                </li>
              ))}
            </ol>
```
Spec §3 (coordinator proposal): 3 columns x 8 rows of numbered word chips; chip h-12, rounded-md, border `--border`, number muted body-sm + word semibold body-md. The panel is 430px wide so the `sm:` breakpoint never applies — the current grid is effectively 2 columns. Replace with: grid-cols-3 always; each chip `flex h-12 items-center gap-2 rounded-md border bg-card px-3`; number span `text-body-sm font-medium text-muted-foreground` showing `{index + 1}.`; word span `text-body-md font-semibold`. Keep the same `<ol aria-label="Recovery phrase">` wrapper, the same `words.map`, the same keys. No other changes to step 2.

Acceptance: no `#` hex, no `slate` anywhere in your returned blocks; grid is `grid-cols-3` with no `sm:` variant; chips are `h-12`; progress circles are 40px (`size-10`); current step is named in text; `tsc`-clean (all imports used).

Return ONLY the two replacement blocks, numbered 1 and 2, each in its own ```tsx fenced block, with the exact old text quoted above each block so the applier can match it. No explanation, no other changes.
