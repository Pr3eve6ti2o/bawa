import { useEffect, useMemo, useState } from 'react';
import {
  fetchPriceHistory,
  formatChangePct,
  formatUnitPriceUsd,
  type PriceHistoryPoint,
} from '../wallet/prices';
import { Skeleton } from '../ui/components/skeleton';

/**
 * Lane 4 (UX-major, data): a small 7-day price chart for one asset,
 * lazy-loaded so its code never lands in the main bundle. The data is
 * real CoinGecko market-chart history only (see
 * fetchPriceHistory in wallet/prices.ts): one on-demand call when
 * the asset screen mounts, never on a timer. A missing id, an empty
 * chart, a rate limit or any fetch failure renders the honest state
 * below — never invented points, never a flat line through one price.
 * Drawing style follows the design system: a 2 px ink line on paper,
 * the last point marked in sun. No new colours, no new dependency.
 */

const MAX_PLOTTED_POINTS = 48;

type ChartState =
  | { status: 'loading' }
  | { status: 'ready'; points: PriceHistoryPoint[] }
  | { status: 'unavailable' }
  | { status: 'error'; reason: string };

function downsample(
  points: PriceHistoryPoint[],
  max: number,
): PriceHistoryPoint[] {
  if (points.length <= max) return points;
  const stride = Math.ceil(points.length / max);
  const sampled = points.filter((_, index) => index % stride === 0);
  const last = points[points.length - 1];
  if (last !== undefined && sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function chartErrorText(reason: string): string {
  // Chisel (Numeric Licensing Cascade): no duration is promised here —
  // the retry delay is CoinGecko's Retry-After, which this component
  // never sees, so "try again in a minute" would be an invented
  // number. The state is named, the wait is not.
  if (reason === 'rate-limited') {
    return 'Chart unavailable — CoinGecko is rate-limiting charts right now.';
  }
  if (reason === 'timeout') {
    return 'Chart unavailable — the price-history request timed out.';
  }
  if (reason === 'network') {
    return 'Chart unavailable — check your connection and try again.';
  }
  return 'Chart unavailable — the price-history feed could not be read.';
}

export function PriceChart({
  coingeckoId,
  label,
}: {
  coingeckoId: string | null;
  label: string;
}) {
  const [state, setState] = useState<ChartState>({ status: 'loading' });

  useEffect(() => {
    if (coingeckoId === null) {
      setState({ status: 'unavailable' });
      return;
    }
    let mounted = true;
    setState({ status: 'loading' });
    void fetchPriceHistory(globalThis.fetch, coingeckoId).then((result) => {
      if (!mounted) return;
      if (result.status === 'ok') {
        setState({ status: 'ready', points: result.points });
      } else if (result.status === 'unavailable') {
        setState({ status: 'unavailable' });
      } else {
        setState({ status: 'error', reason: result.reason });
      }
    });
    return () => {
      mounted = false;
    };
  }, [coingeckoId]);

  const plotted = useMemo(
    () =>
      state.status === 'ready'
        ? downsample(state.points, MAX_PLOTTED_POINTS)
        : [],
    [state],
  );

  const geometry = useMemo(() => {
    if (plotted.length < 2) return null;
    const prices = plotted.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min;
    const width = 320;
    const height = 96;
    const pad = 4;
    const xy = plotted.map((point, index) => {
      const x =
        pad + (index / (plotted.length - 1)) * (width - pad * 2);
      const y =
        span === 0
          ? height / 2
          : height - pad - ((point.price - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const last = xy[xy.length - 1];
    if (last === undefined) return null;
    return { points: xy.join(' '), last };
  }, [plotted]);

  const first = plotted[0];
  const lastPoint = plotted[plotted.length - 1];
  const periodChange =
    first !== undefined &&
    lastPoint !== undefined &&
    first.price > 0
      ? formatChangePct(((lastPoint.price - first.price) / first.price) * 100)
      : null;

  return (
    <section
      aria-label={`Price chart for ${label}`}
      className="space-y-3 rounded-bawa border-2 border-ink bg-paper p-4"
    >
      <h2 className="text-lg font-semibold text-ink">
        Price · last 7 days
      </h2>
      {state.status === 'loading' ? (
        <div role="status">
          <Skeleton className="h-[120px] w-full" />
          <span className="sr-only">Loading price chart…</span>
        </div>
      ) : state.status === 'unavailable' ? (
        <p className="text-sm text-ink">
          No chart data for this asset yet.
        </p>
      ) : state.status === 'error' ? (
        <p className="text-sm text-ink">{chartErrorText(state.reason)}</p>
      ) : geometry === null || first === undefined || lastPoint === undefined ? (
        <p className="text-sm text-ink">
          No chart data for this asset yet.
        </p>
      ) : (
        <>
          <svg
            viewBox="0 0 320 96"
            role="img"
            aria-label={`Price of ${label} over the last 7 days, ${periodChange ?? 'movement unknown'}`}
            className="h-[96px] w-full text-ink"
            preserveAspectRatio="none"
          >
            <polyline
              points={geometry.points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle
              cx={geometry.last.split(',')[0]}
              cy={geometry.last.split(',')[1]}
              r="4"
              fill="var(--bawa-sun)"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <p className="text-sm text-ink">
            {formatUnitPriceUsd(String(first.price))}
            {' → '}
            {formatUnitPriceUsd(String(lastPoint.price))}
            {periodChange !== null ? ` (${periodChange} over 7 days)` : ''}
          </p>
        </>
      )}
      <p className="text-xs leading-[18px] text-panel-text-muted">
        Prices from CoinGecko.
      </p>
    </section>
  );
}
