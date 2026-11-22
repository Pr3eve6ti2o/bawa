import { cn } from '../lib/utils'
import type { ReactNode } from 'react'

interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value?: string
  detail?: string
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
  verified,
  subline,
  className,
  ...props
}: AssetRowProps) {
  return (
    <div
      data-slot="asset-row"
      className={cn('flex min-h-[68px] items-center justify-between rounded-lg px-4 py-3', className)}
      {...props}
    >
      <div className="flex items-center gap-3">
        {avatar}
        <div>
          <div className="text-base font-semibold">
            {symbol}
            {verified === true && (
              <span className="ml-2 text-sm font-normal" aria-label="Verified token">✓ Verified</span>
            )}
          </div>
          {' '}
          {subline !== undefined && (
            <div className="text-xs text-ink">{subline}</div>
          )}
          <div className="text-sm text-ink">{amount}</div>
        </div>
      </div>
      {' '}
      {(value || detail) && (
        <div className="text-right">
          {value ? <div className="text-base font-semibold">{value}</div> : null}
          {' '}
          {detail ? (
            <div className="text-xs text-ink">{detail}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { AssetRow }
