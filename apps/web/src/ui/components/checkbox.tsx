"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

import { cn } from "../lib/utils"
import { BawaIcon } from "./icons"

// Lane T (P1 UI/UX build, item 4): one checkbox size, 24x24px
// (was 16x16). The check glyph is 16px — the smallest BawaIcon size.
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-6 shrink-0 rounded-bawa-sm border-2 border-ink bg-paper text-ink",
        "transition-colors data-[state=checked]:bg-coral",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-ink transition-none"
      >
        <BawaIcon name="check" className="size-4" aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
