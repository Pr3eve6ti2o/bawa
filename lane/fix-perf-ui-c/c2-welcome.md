Rewrite apps/web/src/screens/welcome.tsx (Bawa Web Wallet, worktree /home/boxd/workspace/bawa-panel-rebuild/fix-perf-c, branch panel-rebuild/fix-perf-ui-c). UI-only rewrite from the spec below. Change NO words except where the spec gives new copy. Change NO routes, NO component imports beyond what the new layout needs, NO logic (there is none on this screen).

Current file (exact):
```tsx
import { Link } from "react-router";
import { Button } from "../ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/components/card";

export function WelcomeScreen() {
  return (
    <section
      aria-labelledby="welcome-title"
      className="space-y-6"
    >
      <div className="rounded-[30px] border border-white/10 bg-[#243454] p-7 text-white sm:p-8">
        <p className="text-sm font-bold tracking-widest text-[#b4aaff]">BAWA</p>
        <h1
          id="welcome-title"
          className="mt-3 text-3xl font-bold tracking-tight text-white"
        >
          Welcome to Bawa Web Wallet
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#aab5d1]">
          A self-custodial multi-chain wallet. Create a wallet in the browser
          — your recovery phrase is encrypted on this device with your vault
          password — or import a watch-only wallet to track addresses without
          holding secrets.
        </p>
        <div className="mt-6 flex h-11 items-center justify-between rounded-[12px] bg-[#243454] px-4">
          <p className="text-xs font-semibold text-[#c8d5f0]">Network</p>
          <span className="flex h-6 items-center rounded-[12px] bg-[#224f45] px-3 text-[10px] font-bold text-[#94e1c3]">
            MAINNET
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col rounded-[20px] border-[#d6deed]">
          <CardHeader>
            <CardTitle>Create a wallet</CardTitle>
            <CardDescription>
              Generate a recovery phrase in the browser and encrypt it on this
              device with a vault password. Only you hold the phrase.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild className="w-full">
              <Link to="/create-wallet">Create a wallet</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="flex flex-col rounded-[20px] border-[#d6deed]">
          <CardHeader>
            <CardTitle>Import a wallet</CardTitle>
            <CardDescription>
              Restore a wallet from its recovery phrase, or paste an extended
              public key (xpub) to view its derived addresses watch-only.
              Never paste recovery words, seeds or private keys into a
              watch-only import.
            </CardDescription>
          </CardHeader>
          <CardContent className="mt-auto">
            <Button asChild variant="outline" className="w-full">
              <Link to="/import-wallet">Import a wallet</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-2 rounded-[20px] border border-[#d6deed] bg-card p-4 text-sm text-muted-foreground">
        <p>Mainnet only — this wallet never connects to a test network.</p>
        <p>
          Balances and history come from the mainnet adapters. Sending signs
          offline; broadcast is disabled until separately authorised.
        </p>
      </aside>
    </section>
  );
}
```

Spec (UI-UX-REFERENCE.md §2, Rabby branded-entry hierarchy). Layout top-to-bottom:
1. Brand block: the Bawa wallet-icon tile already sits in the shell header directly above, so do NOT duplicate it here; this block keeps the "BAWA" eyebrow, "Welcome to Bawa Web Wallet" title, and paragraph. The block is a `--panel-surface-raised` surface in tokens (no one-off hex card). Eyebrow uses the panel accent token; title is title-lg (28px/36px, use the `text-title-lg` utility) bold in panel text; paragraph is body-md in `--panel-text-muted`.
2. Network row with MAINNET pill (keep; pill h-6 px-3 10px bold, `--panel-success-pill-bg` / `--panel-success-pill-text` tokens; row label in `--panel-text-soft`). The row sits on the darker `--panel-surface` as an inset inside the brand block.
3. NEW four-step preview inside the brand block, below the Network row: a numbered list of the four create steps, each row flex gap-3, rounded-xl, p-4, with a 40px numbered circle (todo-circle styling: `bg-surface-blue-dim` background + primary text, semibold number) and a semibold label in panel text. Build the rows by hand — do NOT reuse the StepCard component (it forces a card background and a detail line this preview does not have). Exact labels: "1 Set a vault password", "2 Write down 24 words", "3 Confirm 3 words", "4 See your addresses". Render the number inside the circle and the label text without the leading digit (number 1 with label "Set a vault password", etc.).
4. Create a wallet / Import a wallet Cards, keeping their descriptions and full-width Buttons (Button h-10, Card rounded-xl, header px-6/pt-6). Use `--card` consistently for content surfaces; drop the hardcoded `border-[#d6deed]` override so the Card's own border token applies in both themes. Create button is the primary Button; Import is outline. Keep the two-card grid.
5. Mainnet-only, offline-signing, broadcast-disabled aside (keep both paragraphs word-for-word; `bg-card`, `text-muted-foreground`, border token not a hardcoded hex).

Colour: `--panel-*` tokens for the dark brand block; `--card` / `--foreground` / `--muted-foreground` / `--border` for the two Cards; `--primary` for the Create button; `--ring` for focus. The panel tokens exist as Tailwind utilities: `bg-panel-surface-raised`, `bg-panel-surface`, `text-panel-accent`, `text-panel-text`, `text-panel-text-muted`, `text-panel-text-soft`, `bg-panel-success-pill-bg`, `text-panel-success-pill-text`, `border-panel-border`. Use ONLY token classes — no `#hex`, no `white/10`, no `slate-*`, no `text-white` on the dark block (use `text-panel-text`).

Acceptance: no `#` hex, no `white/` opacity, no `slate` in the file; title uses `text-title-lg`; the four preview labels appear exactly as given; both aside paragraphs word-for-word; both Card descriptions word-for-word; no sample words or addresses; `tsc`-clean TypeScript (imports used, no unused imports).

Return ONLY the complete new welcome.tsx in one ```tsx fenced block. No explanation, no other changes.
