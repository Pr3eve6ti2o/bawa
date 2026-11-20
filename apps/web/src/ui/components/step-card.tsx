import { cn } from '../lib/utils'
import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

type StepState = 'pending' | 'active' | 'completed'

interface StepCardProps extends React.ComponentProps<'div'> {
  icon: ReactNode
  label: string
  detail: string
  state?: StepState
}

function StepCard({ icon, label, detail, state = 'pending', className, ...props }: StepCardProps) {
  return (
    <div
      data-slot="step-card"
      data-state={state}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        state === 'completed' && 'border-success-border bg-success-surface-tint',
        state === 'active' && 'border-info-border bg-surface-blue',
        state === 'pending' && 'border-border bg-card',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          state === 'completed'
            ? 'bg-success text-success-foreground'
            : 'bg-surface-blue-dim text-step-pending-text',
        )}
      >
        {state === 'completed' ? <Check className="h-5 w-5" /> : icon}
      </div>
      <div>
        <div className="text-sm-plus font-bold">{label}</div>
        {/* The active card sits on the pale blue tint (light) / deep
            blue (dark), where muted-foreground drops to 4.32:1 — below
            AA. The active detail therefore uses the standard body text
            colour; hierarchy is kept by size and weight, not colour. */}
        <div
          className={cn(
            'mt-1 text-xs-plus leading-relaxed',
            state === 'active' ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {detail}
        </div>
      </div>
    </div>
  )
}

export type { StepState }
export { StepCard }
