Fix ONE low-contrast text problem in apps/web/src/screens/welcome.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-copy, branch panel-rebuild/fix-copy). Change a colour class only — do NOT change any words. Change NOTHING else in the file.

The problem: the footnote at the bottom of the Welcome screen is this element:
<aside className="space-y-2 rounded-[20px] border border-[#d6deed] bg-white p-4 text-sm text-muted-foreground">
It sits inside the app shell div with class "bawa-panel". In apps/web/src/ui/styles/globals.css, .bawa-panel sets --muted-foreground to rgb(170 181 209), a very pale blue-grey, and that pale value is what this aside renders in — on a white background, so the footnote is barely readable (about 1.9:1 contrast).

The same stylesheet has this override, designed for white cards inside the panel:
.bawa-panel .bg-card { --muted-foreground: rgb(100 113 140); --primary: rgb(98 88 217); }
That darker muted value on white gives about 4.8:1 contrast, readable.

Decide the minimal class change to the aside element that makes its text use the darker readable muted colour, without changing any words and without touching globals.css. The obvious candidate is changing bg-white to bg-card on the aside so the existing override applies — confirm whether that is correct, or give a better minimal alternative if it is not.

Return ONLY: (a) the exact replacement opening <aside ...> tag line, and (b) one line stating the before and after contrast ratios. No explanation, no other changes.

Acceptance: words unchanged; the replacement tag still has the same layout classes; the text will render at 4.5:1 contrast or better on white.
