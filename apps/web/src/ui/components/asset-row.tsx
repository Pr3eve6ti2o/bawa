import { cn } from '../lib/utils'
import type { ReactNode } from 'react'

interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value?: string
  detail?: string
  detailColor?: string
}

function AssetRow({
  avatar,
  symbol,
  amount,
  value,
  detail,
  detailColor,
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
          <div className="text-base font-semibold">{symbol}</div>
          {' '}
          <div className="text-sm text-muted-foreground">{amount}</div>
        </div>
      </div>
      {' '}
      {(value || detail) && (
        <div className="text-right">
          {value ? <div className="text-base font-semibold">{value}</div> : null}
          {' '}
          {detail ? (
            <div
              data-design-audit-allow="dynamic-token-color"
              className="text-xs"
              style={detailColor ? { color: detailColor } : undefined}
            >
              {detail}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export { AssetRow }
