// sonner.tsx — minimal Toaster (Lane C, token-verify programme).
//
// Replaces the sonner <Toaster> with a rendering of the toast store in
// ./toast. The visuals are the same as the sonner configuration this
// file carried: top-right, flat 12px radius, 1 px ink border, paper
// background, ink text, no shadow (P3-B flattened the old wobbly
// radius + 2 px border); success toasts use the light-green surface
// with a green border, error toasts the red border, warning toasts
// keep the sun background. Only the enter animation is gone (toasts
// appear at once); the auto-dismiss timing (4 s) and the placement
// are unchanged.
//
// Lane P2-B (M4): a toast can carry an action link (the lifecycle
// toast's "View on Explorer →") and a dismiss button — the submitted
// stage stays on screen until the transaction confirms, so the user
// must be able to close it by hand. The message keeps its line breaks
// (the submitted stage shows the hash under its title).
import { cn } from '../lib/utils'
import { toast, useToasts, type ToastKind } from './toast'

const KIND_CLASSES: Record<ToastKind, string> = {
  success: 'border-success bg-success-surface text-ink',
  warning: 'border-ink bg-sun text-ink',
  error: 'border-error bg-paper text-ink',
  info: 'border-ink bg-paper text-ink',
  normal: 'border-ink bg-paper text-ink',
}

function Toaster({ className }: { className?: string }) {
  const toasts = useToasts()
  if (toasts.length === 0) return null
  return (
    <div
      data-slot="toaster"
      aria-live="polite"
      className={cn(
        'toaster group fixed right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2',
        className,
      )}
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cn(
            'toast rounded-flat-lg border px-4 py-3 text-base shadow-none',
            KIND_CLASSES[item.kind],
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="min-w-0 whitespace-pre-line break-words">{item.message}</p>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => toast.dismiss(item.id)}
              className="shrink-0 rounded-flat-sm px-2 py-0.5 text-base font-bold leading-none hover:bg-panel-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              ×
            </button>
          </div>
          {item.action && (
            <a
              href={item.action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block break-all font-medium text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {item.action.label}
            </a>
          )}
        </div>
      ))}
    </div>
  )
}

export { Toaster }
