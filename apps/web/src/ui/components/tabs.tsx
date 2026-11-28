"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "../lib/utils"

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-2 text-ink", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "inline-flex h-14 w-fit items-center justify-center rounded-flat-lg border border-ink bg-paper p-1 text-ink",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-flat-sm border border-transparent bg-transparent px-2 py-1 text-sm font-semibold whitespace-nowrap text-ink transition-colors disabled:pointer-events-none disabled:text-ink data-[state=active]:bg-sun data-[state=active]:text-ink data-[state=active]:border data-[state=active]:border-ink [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger }
