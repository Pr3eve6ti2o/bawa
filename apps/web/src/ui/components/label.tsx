"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"

import { cn } from "../lib/utils"

// Lane C (token-verify programme): tailwind-merge is gone, so cn() is a
// plain join and conflicting classes are NOT resolved. Label takes its
// one overridable weight as a prop and emits exactly one font-weight
// and one line-height class.
function Label({
  className,
  weight = "medium",
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & {
  /** "medium" is the default (font-semibold, leading-5 — the Label role, 14px/600/20px); "normal" is the long-form label (font-normal, leading-5). */
  weight?: "medium" | "normal"
}) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm text-ink select-none group-data-[disabled=true]:pointer-events-none peer-disabled:cursor-not-allowed",
        weight === "normal" ? "font-normal leading-5" : "font-semibold leading-5",
        className
      )}
      {...props}
    />
  )
}

export { Label }
