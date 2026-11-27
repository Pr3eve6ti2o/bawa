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
  /** Corner radius: "sm" is the default rounded-bawa-sm; "bawa" is the larger rounded-bawa. */
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
        "min-w-0 border-2 border-ink bg-paper px-4 text-base placeholder:text-ink selection:bg-sun selection:text-ink transition-colors",
        radius === "bawa" ? "rounded-bawa" : "rounded-bawa-sm",
        height === "md" ? "h-11" : "h-12",
        width === "sm" ? "w-28" : "w-full",
        "enabled:text-ink",
        "file:inline-flex file:h-7 file:border-0 file:bg-paper file:text-sm file:font-semibold file:text-ink",
        "focus-visible:border-ink focus-visible:underline focus-visible:decoration-wavy focus-visible:decoration-coral focus-visible:underline-offset-8",
        "aria-invalid:border-coral aria-invalid:underline aria-invalid:decoration-wavy aria-invalid:decoration-coral aria-invalid:underline-offset-8 aria-invalid:focus-visible:border-coral",
        "disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink disabled:opacity-40 disabled:aria-invalid:border-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
