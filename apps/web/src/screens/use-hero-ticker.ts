import { useEffect, useRef, useState } from 'react';

/**
 * Parse an exact "$1,234.56" hero string, or null for anything else
 * ("Unavailable", "$1,234.56 (Partial)", "Locked", "••••••"). Only an
 * exact dollar total is a value the ticker may count from or to.
 */
export function parseDollarAmount(text: string): number | null {
  const match = /^\$([\d,]+\.\d{2})$/.exec(text);
  if (match === null) return null;
  const value = Number(match[1]?.replace(/,/g, ''));
  return Number.isFinite(value) ? value : null;
}

/** Format exactly as the hero does: "$1,234.56". */
export function formatDollarAmount(value: number): string {
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const TICKER_MS = 600;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Magic UI Number Ticker pattern, honest variant (Lane J): the hero
 * total counts between two settled dollar values instead of jumping.
 * It NEVER counts from $0.00 — on first load, and whenever either side
 * is not an exact dollar amount (Unavailable, Partial, Locked, masked),
 * the new value renders immediately, because there is no real previous
 * value to count from. Reduced motion also renders immediately
 * (ui-ux-pro-max pre-delivery checklist). The count runs on
 * requestAnimationFrame for 600 ms, ease-out, and is cancelled when the
 * target changes again or the screen unmounts.
 */
export function useAnimatedHeroValue(target: string): string {
  const [shown, setShown] = useState(target);
  const previousRef = useRef(target);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = target;
    if (previous === target) return;
    const from = parseDollarAmount(previous);
    const to = parseDollarAmount(target);
    if (from === null || to === null || prefersReducedMotion()) {
      setShown(target);
      return;
    }
    let frame = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / TICKER_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(formatDollarAmount(from + (to - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return shown;
}
