// gate-verdict.mjs — the quality-gates verdict line (F-41). Pure
// function, no I/O: 'quality-gates: OK' only with no failures AND no
// skips; otherwise the skips are named. Exit 0 is preserved for
// intentional --skip-android (the caller decides the exit code from
// the failure count, not from the verdict string).
export function verdict(failures, skippedNames) {
  if (failures > 0) {
    const skips = skippedNames.length > 0
      ? ` (${skippedNames.length} skipped: ${skippedNames.join(', ')})`
      : '';
    return `quality-gates: FAILED (${failures} gates failed)${skips}`;
  }
  if (skippedNames.length > 0) {
    return `quality-gates: OK with skips (${skippedNames.length} skipped: ${skippedNames.join(', ')})`;
  }
  return 'quality-gates: OK';
}
