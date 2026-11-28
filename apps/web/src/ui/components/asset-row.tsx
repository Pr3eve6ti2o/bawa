import { cn } from '../lib/utils'
import { Badge } from "./badge";
import { BawaIcon } from "./icons";
import type { ReactNode } from 'react'

interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value?: string
  detail?: string
  /** P3-B (style B): the 24 h movement, coloured by direction
      (green up, red down) on the same detail line — the sign (+/-)
      stays, so colour is never the only signal. */
  change24h?: { text: string; stale: boolean; direction: 'up' | 'down' | 'flat' }
  /** Token gaps, item 2: show the VERIFIED tick beside an official token. */
  verified?: boolean
  /** Token gaps, item 2: short contract under the token, e.g. 0xA0b8…eB48. */
  subline?: string
}

function AssetRow({
  avatar,
  symbol,
  amount,
  value,
  detail,
  change24h,
  verified,
  subline,
  className,
  ...props
}: AssetRowProps) {
  return (
    <div
      data-slot="asset-row"
      // Lane 4: the two columns keep their own width on a narrow row —
      // the left (name + amount) flexes and shrinks, the right (value
      // + price detail) keeps a capped width below the desktop
      // breakpoint, so a long price line can no longer squeeze the
      // name into "BNB Smart / Chain" and "Zero / balance". The cap is
      // mobile-only: the desktop row keeps its old unconstrained shape.
      className={cn('flex min-h-[68px] items-center justify-between gap-3 rounded-flat-lg px-4 py-3', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {avatar}
        <div className="min-w-0">
          <div className="text-base font-semibold">
            {symbol}
            {verified === true && (
              // Lane 4: the tick never splits from its label.
              <Badge size="sm" className="ml-2 whitespace-nowrap" icon={<BawaIcon name="check" aria-hidden="true" />} aria-label="Verified token">Verified</Badge>
            )}
            {/* Lane 1: an unverified token says so — the mark shows
                whether the token is verified or not, never silence. */}
            {verified === false && (
              <span className="ml-2 text-sm font-normal" aria-label="Unverified token">Unverified</span>
            )}
          </div>
          {' '}
          {subline !== undefined && (
            <div className="text-xs text-ink">{subline}</div>
          )}
          <div className="text-base text-ink">{amount}</div>
        </div>
      </div>
      {' '}
      {(value || detail || change24h) && (
        <div className="max-desktop:max-w-[7rem] max-desktop:shrink-0 text-right">
          {value ? <div className="text-base font-semibold">{value}</div> : null}
          {' '}
          {detail || change24h !== undefined ? (
            <div className="text-xs text-ink">
              {detail ?? null}
              {detail !== undefined && change24h !== undefined ? ' · ' : null}
              {change24h !== undefined ? (
                <span
                  className={
                    change24h.direction === 'up'
                      ? 'text-success'
                      : change24h.direction === 'down'
                        ? 'text-error'
                        : 'text-muted-foreground'
                  }
                >
                  {change24h.text}
                  {change24h.stale ? ' · stale' : ''}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { AssetRow }
