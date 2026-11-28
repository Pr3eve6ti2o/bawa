import * as React from "react"

import { cn } from "../lib/utils"

// Lane C (token-verify programme): tailwind-merge is gone, so cn() is a
// plain join and conflicting classes are NOT resolved. Input therefore
// takes its overridable size as props — radius, height, width — and
// emits exactly one class per property. Call sites must use the props,
// not a conflicting className.
function Input({
  className,
  type,
  radius = "sm",
  height = "lg",
  width = "full",
  ...props
}: React.ComponentProps<"input"> & {
  /** Corner radius: "sm" is the default rounded-flat-sm; "bawa" is the larger rounded-flat. P3-B: both are uniform now — the wobbly radii are retired on inputs. */
  radius?: "sm" | "bawa"
  /** Height: "lg" is the default h-12; "md" is h-11. */
  height?: "lg" | "md"
  /** Width: "full" is the default w-full; "sm" is w-28. */
  width?: "full" | "sm"
}) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-w-0 border border-ink bg-paper px-4 text-base placeholder:text-muted-foreground selection:bg-sun selection:text-ink transition-colors",
        radius === "bawa" ? "rounded-flat" : "rounded-flat-sm",
        height === "md" ? "h-11" : "h-12",
        width === "sm" ? "w-28" : "w-full",
        "enabled:text-ink",
        "file:inline-flex file:h-7 file:border-0 file:bg-paper file:text-sm file:font-semibold file:text-ink",
        // P3-B (style B): no wavy underline on focus or invalid — the
        // global :focus-visible 2px ink outline is the focus signal,
        // and the red invalid border + the error text beside the
        // field is the invalid signal.
        "focus-visible:border-ink",
        "aria-invalid:border-error aria-invalid:focus-visible:border-error",
        "disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink disabled:opacity-40 disabled:aria-invalid:border-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
