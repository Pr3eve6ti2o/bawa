// P3-A (style B, 2026-11-28): the one phrase-tile grid shared by the
// Create flow (screens/create-wallet.tsx, step 2) and the
// mnemonic-backup reveal (screens/backup.tsx). Flat, numbered, mono:
// uniform 8px radius, 1px hairline border, no shadow, JetBrains Mono
// words — Baloo 2 stays off the words (brand headings only). Three
// columns at desktop, not four: in the backup reveal's half-width
// column a fourth column squeezes 8-letter words to an ellipsis
// ("indica…") — a recovery word must never be visually cut. The
// number is visual only (aria-hidden): the <ol> already announces
// each item's position to screen readers, so it is not read twice.
export function RecoveryPhraseGrid({ words }: { words: readonly string[] }) {
  return (
    <ol
      aria-label="Recovery phrase"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
    >
      {words.map((word, index) => (
        <li
          key={index}
          className="flex h-12 min-w-0 items-center gap-2 rounded-flat-sm border border-border bg-card px-3"
        >
          <span aria-hidden="true" className="font-mono text-sm text-ink">
            {index + 1}.
          </span>
          {' '}
          <span className="min-w-0 truncate font-mono text-base text-ink">
            {word}
          </span>
        </li>
      ))}
    </ol>
  );
}
