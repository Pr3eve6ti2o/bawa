// NumberTicker — Magic UI Number Ticker pattern (source: RESEARCH.md
// §12, magicui.design; MIT), re-implemented for Bawa's tokens: a dollar
// total that counts to its value on load and ticks to its new value when
// it changes, instead of appearing or flashing. Only the hero total uses
// it — numbers elsewhere stay static (Magic UI is animation-first;
// Bawa's style is hand-drawn and calm, so motion is spent on the one
// number the screen is about).
//
// Behaviour:
// - Plain dollar amounts ("$62,683.00", with an optional " (Partial)"
//   suffix kept static) count from the previously shown value.
// - Anything else ("Unavailable", "Locked", the masked "••••••") renders
//   statically — a number that is not a number never animates.
// - prefers-reduced-motion is respected (ui-ux-pro-max pre-delivery
//   checklist, RESEARCH.md §1): reduced motion, or no matchMedia API at
//   all (jsdom, SSR), renders the final value immediately with no
//   animation. That also keeps the dashboard tests deterministic: they
//   assert the settled total, and in their environment the ticker is
//   already settled.
import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 700;

function parseDollarAmount(text: string): number | null {
  const match = /^\$([\d,]+\.\d{2})$/.exec(text.trim());
  if (match === null) return null;
  const digits = match[1];
  if (digits === undefined) return null;
  return Number(digits.replace(/,/g, ''));
}

function formatDollarAmount(value: number): string {
  return (
    '$' +
    value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  if (typeof window.matchMedia !== 'function') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function NumberTicker({ text }: { text: string }) {
  // A trailing " (Partial)" stays outside the animated number.
  const suffix = text.endsWith(' (Partial)') ? ' (Partial)' : '';
  const numericPart = suffix === '' ? text : text.slice(0, -suffix.length);
  const target = parseDollarAmount(numericPart);
  const previousRef = useRef(0);
  // Starts at $0.00 and counts up on mount (the Magic UI behaviour);
  // a null target never uses this value.
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (target === null) return;
    if (prefersReducedMotion() || previousRef.current === target) {
      previousRef.current = target;
      setDisplayed(target);
      return;
    }
    const from = previousRef.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      // easeOutCubic: fast start, gentle landing.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (target - from) * eased;
      setDisplayed(current);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previousRef.current = target;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      previousRef.current = target;
    };
  }, [target]);

  if (target === null) {
    return <>{text}</>;
  }
  return (
    <>
      {formatDollarAmount(displayed)}
      {suffix}
    </>
  );
}
