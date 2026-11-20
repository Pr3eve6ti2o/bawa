import { cn } from '../lib/utils'
import { Toaster as Sonner, type ToasterProps } from 'sonner'

function Toaster({ className, ...props }: ToasterProps) {
  return (
    <Sonner
      data-slot="toaster"
      data-design-audit-allow="third-party-theme-vars"
      position="top-right"
      className={cn('toaster group', className)}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-bawa group-[.toaster]:border-2 group-[.toaster]:border-ink group-[.toaster]:bg-paper group-[.toaster]:text-ink group-[.toaster]:shadow-none',
          description: 'group-[.toast]:text-ink',
          actionButton: 'group-[.toast]:bg-coral group-[.toast]:text-ink',
          cancelButton:
            'group-[.toast]:border-2 group-[.toast]:border-ink group-[.toast]:bg-paper group-[.toast]:text-ink',
          success:
            'group-[.toaster]:border-2 group-[.toaster]:border-ink group-[.toaster]:bg-sun group-[.toaster]:text-ink',
          error:
            'group-[.toaster]:border-2 group-[.toaster]:border-coral group-[.toaster]:bg-paper group-[.toaster]:text-ink',
          warning:
            'group-[.toaster]:border-2 group-[.toaster]:border-ink group-[.toaster]:bg-sun group-[.toaster]:text-ink',
          info:
            'group-[.toaster]:border-2 group-[.toaster]:border-ink group-[.toaster]:bg-paper group-[.toaster]:text-ink',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--bawa-paper)',
          '--normal-text': 'var(--bawa-ink)',
          '--normal-border': 'var(--bawa-ink)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
