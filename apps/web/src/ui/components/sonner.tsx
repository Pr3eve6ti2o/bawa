// sonner.tsx — minimal Toaster (Lane C, token-verify programme).
//
// Replaces the sonner <Toaster> with a rendering of the toast store in
// ./toast. The visuals are the same as the sonner configuration this
// file carried: top-right, rounded-bawa, 2 px ink border, paper
// background, ink text, no shadow; success and warning toasts use the
// sun background, error toasts use the coral border. Only the enter
// animation is gone (toasts appear at once); the auto-dismiss timing
// (4 s) and the placement are unchanged.
import { cn } from '../lib/utils'
import { useToasts, type ToastKind } from './toast'

const KIND_CLASSES: Record<ToastKind, string> = {
  success: 'border-ink bg-sun text-ink',
  warning: 'border-ink bg-sun text-ink',
  error: 'border-coral bg-paper text-ink',
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
            'toast rounded-bawa border-2 px-4 py-3 text-base shadow-none',
            KIND_CLASSES[item.kind],
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  )
}

export { Toaster }
