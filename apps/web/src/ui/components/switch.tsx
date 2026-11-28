"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../lib/utils"

// Lane T (P1 UI/UX build, item 4): one switch size, 48x28px track
// (was 32x20). Lane A (wobbly-cards): flat shape — 1px hairline
// border + uniform 8px radius. Thumb is 26px border-box, so it
// fills the 26px inner track height exactly (28 - 2x1px) and
// travels 20px when checked (46px inner width - 26px thumb),
// landing flush against the inner right edge. (The old comment's
// "20px + 2px border = 24px" assumed content-box; under border-box
// the old thumb measured 20px outer with 2px top/bottom gaps and a
// 4px shortfall on the right when checked.)
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-7 w-12 shrink-0 items-center rounded-flat-sm border border-ink bg-paper",
        "transition-colors data-[state=checked]:bg-coral data-[state=unchecked]:bg-paper",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-[26px] shrink-0 rounded-flat-sm border border-ink bg-paper",
          "transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
