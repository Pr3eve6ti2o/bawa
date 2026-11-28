"use client"

import * as React from "react"
import { createPortal } from "react-dom"

import { cn } from "../lib/utils"
import { BawaIcon } from "./icons"

// Minimal dialog (merge lane, bundle-size gate, 2026-11-24): replaces
// @radix-ui/react-dialog (stub-measured saving 26,572 bytes minified;
// the Radix tree pulled in remove-scroll, roving-focus,
// dismissable-layer, focus-scope and friends, all used only by this
// one dialog — the Add Token dialog). Same exports, same visuals,
// same open/close behaviour: Escape closes, clicking the overlay
// closes, focus is trapped while open and returned on close, body
// scroll is locked while open, and the content portals to
// document.body. The open animation classes still apply (data-state
// is "open" while rendered); there is no close animation — the dialog
// disappears at once instead of fading out over 200 ms.

type DialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext(): DialogContextValue | null {
  return React.useContext(DialogContext)
}

function Dialog({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : uncontrolledOpen
  const titleId = React.useId()
  const descriptionId = React.useId()
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [controlled, onOpenChange]
  )
  const value = React.useMemo(
    () => ({ open, setOpen, titleId, descriptionId }),
    [open, setOpen, titleId, descriptionId]
  )
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const ctx = useDialogContext()
  return (
    <div
      data-slot="dialog-overlay"
      data-state="open"
      aria-hidden="true"
      className={cn(
        "fixed inset-0 z-50",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      onClick={() => ctx?.setOpen(false)}
      {...props}
    />
  )
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  const ctx = useDialogContext()
  const contentRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!ctx?.open) return
    const content = contentRef.current
    if (!content) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    content.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        ctx.setOpen(false)
        return
      }
      if (event.key !== "Tab") return
      const focusable = Array.from(content.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
        (el) => (el as HTMLElement).offsetParent !== null || el === document.activeElement
      ) as HTMLElement[]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => {
      document.removeEventListener("keydown", onKeyDown, true)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [ctx?.open])

  if (!ctx?.open) return null
  return createPortal(
    <>
      <DialogOverlay />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ctx.titleId}
        aria-describedby={ctx.descriptionId}
        data-slot="dialog-content"
        data-state="open"
        tabIndex={-1}
        className={cn(
          // Lane A (mobile overflow, 2026-11-28): two guards the Add
          // Token dialog needed. (1) grid-cols-[minmax(0,1fr)]: the
          // single implicit `auto` column let a grid item's min-content
          // (the search-result rows: long token name + Verified badge
          // on one nowrap line) stretch the dialog to 617 px in a
          // 390 px viewport — the fixed box stayed 358 px, so every
          // child overflowed right and the Use buttons were
          // unreachable. A 0-minimum track caps items at the box.
          // (2) max-h + overflow-y-auto: with results the dialog is
          // ~970 px tall, so a centred dialog cut its title off the
          // top of a phone with no way to scroll to it (body scroll
          // is locked while open). The dialog now scrolls itself.
          "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] grid-cols-[minmax(0,1fr)] max-h-[calc(100dvh-2rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 p-6 sm:max-w-lg",
          "rounded-flat-lg border border-ink bg-paper text-ink",
          "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <button
            type="button"
            data-slot="dialog-close"
            className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-flat-sm text-ink transition-colors hover:bg-sun disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0"
            onClick={() => ctx.setOpen(false)}
          >
            <BawaIcon name="close" className="size-4" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </button>
        )}
      </div>
    </>,
    document.body
  )
}

function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(
        "flex flex-col gap-2 text-center sm:text-left",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<"h2">) {
  const ctx = useDialogContext()
  return (
    <h2
      id={ctx?.titleId}
      data-slot="dialog-title"
      className={cn(
        "font-display text-xl font-semibold leading-7 text-ink",
        className
      )}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const ctx = useDialogContext()
  return (
    <p
      id={ctx?.descriptionId}
      data-slot="dialog-description"
      className={cn("text-base text-ink", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
}
