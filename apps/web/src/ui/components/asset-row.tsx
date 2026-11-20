import { cn } from '../lib/utils'
import type { ReactNode } from 'react'

interface AssetRowProps extends React.ComponentProps<'div'> {
  avatar: ReactNode
  symbol: string
  amount: string
  value?: string
  detail?: string
}

function AssetRow({
  avatar,
  symbol,
  amount,
  value,
  detail,
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
