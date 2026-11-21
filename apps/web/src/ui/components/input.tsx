import * as React from "react"

import { cn } from "../lib/utils"

function Input({
  className,
  type,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-bawa-sm border-2 border-ink bg-paper px-4 text-body-md placeholder:text-ink selection:bg-sun selection:text-ink transition-colors",
        "enabled:text-ink",
        "file:inline-flex file:h-7 file:border-0 file:bg-paper file:text-sm file:font-medium file:text-ink",
        "focus-visible:border-ink focus-visible:underline focus-visible:decoration-wavy focus-visible:decoration-coral focus-visible:underline-offset-8",
        "aria-invalid:border-coral aria-invalid:underline aria-invalid:decoration-wavy aria-invalid:decoration-coral aria-invalid:underline-offset-8 aria-invalid:focus-visible:border-coral",
        "disabled:cursor-not-allowed disabled:border-dashed disabled:border-ink disabled:bg-paper disabled:text-ink disabled:aria-invalid:border-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
