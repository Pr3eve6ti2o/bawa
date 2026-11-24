import * as React from "react"

import { cn } from "../lib/utils"

// Lane C (token-verify programme): tailwind-merge is gone, so cn() is a
// plain join and conflicting classes are NOT resolved. Card therefore
// takes its overridable surface as props — radius, tone, borderTone,
// padding — and emits exactly one class per property. Call sites must
// use the props, not a conflicting className. The data-[size=sm]
// overrides are variant-gated (higher specificity), so they still win
// over the plain classes when size="sm", exactly as before.
function Card({
  className,
  size = "default",
  radius = "bawa",
  tone = "paper",
  borderTone = "ink",
  padding = "md",
  ...props
}: React.ComponentProps<"div"> & {
  size?: "default" | "sm"
  /** Corner radius: "bawa" is the default; "xl" is the softer card used on detail screens. */
  radius?: "bawa" | "xl"
  /** Surface: "paper" is the default; "card" matches the theme card surface. */
  tone?: "paper" | "card"
  /** Border colour: "ink" is the default; "border" is the muted border; "destructive" is the delete-zone border. */
  borderTone?: "ink" | "border" | "destructive"
  /** Padding: "md" is the default py-6; "sm" is p-3 all round. */
  padding?: "md" | "sm"
}) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        "group/card flex flex-col gap-6 border-2",
        radius === "xl" ? "rounded-xl" : "rounded-bawa",
        tone === "card" ? "bg-card text-foreground" : "bg-paper text-ink",
        borderTone === "border"
          ? "border-border"
          : borderTone === "destructive"
            ? "border-destructive/40"
            : "border-ink",
        padding === "sm" ? "p-3" : "py-6",
        "data-[size=sm]:gap-4 data-[size=sm]:py-4",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({
  className,
  padding = "md",
  gap = "sm",
  ...props
}: React.ComponentProps<"div"> & {
  /** Horizontal padding: "md" is px-6; "none" is p-0 (full-bleed header). */
  padding?: "md" | "none"
  /** Row gap: "sm" is gap-1.5; "md" is gap-3. */
  gap?: "sm" | "md"
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        padding === "none" ? "p-0" : "px-6",
        gap === "md" ? "gap-3" : "gap-1.5",
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:[.border-b]:pb-4",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn(
        "font-display font-semibold leading-none text-ink",
        className
      )}
      {...props}
    />
  )
}

function CardDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-ink", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-6 group-data-[size=sm]/card:px-4",
        className
      )}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center px-6 [.border-t]:pt-6",
        "group-data-[size=sm]/card:px-4 group-data-[size=sm]/card:[.border-t]:pt-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
}
