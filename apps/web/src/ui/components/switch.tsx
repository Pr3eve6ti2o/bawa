"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../lib/utils"

// Lane T (P1 UI/UX build, item 4): one switch size, 48x28px track
// (was 32x20). Thumb is 20px + 2px border = 24px, so it fills the
// 24px inner track height exactly and travels 20px when checked.
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-bawa-sm border-2 border-ink bg-paper",
        "transition-colors data-[state=checked]:bg-coral data-[state=unchecked]:bg-paper",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 shrink-0 rounded-bawa-sm border-2 border-ink bg-paper",
          "transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
