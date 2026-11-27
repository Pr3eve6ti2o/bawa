import * as React from "react"

import { cn } from "../lib/utils"

// Lane C (token-verify programme): tailwind-merge is gone, so cn() is a
// plain join and conflicting classes are NOT resolved. Card therefore
// takes its overridable surface as props — radius, tone, borderTone —
// and emits exactly one class per property. Call sites must use the
// props, not a conflicting className. Lane T (P1, item 3): the old
// size="sm" and padding="sm" props are deleted — one card padding
// (16px mobile / 24px desktop, all round) and one inner gap (12px).
function Card({
  className,
  radius = "bawa",
  tone = "paper",
  borderTone = "ink",
  ...props
}: React.ComponentProps<"div"> & {
  /** Corner radius: "bawa" is the default; "xl" is the softer card used on detail screens. */
  radius?: "bawa" | "xl"
  /** Surface: "paper" is the default; "card" matches the theme card surface. */
  tone?: "paper" | "card"
  /** Border colour: "ink" is the default; "border" is the muted border; "destructive" is the delete-zone border, rendered in the link token (#C23A1D, 5.27:1 on paper) — the bright coral at 40% opacity was a faint peach far below the 3:1 non-text bar, and even full-strength coral is only 2.77:1 (same fix as the destructive icon, F4). */
  borderTone?: "ink" | "border" | "destructive"
}) {
  return (
    <div
      data-slot="card"
      className={cn(
        "group/card flex flex-col gap-3 border-2",
        radius === "xl" ? "rounded-xl" : "rounded-bawa",
        tone === "card" ? "bg-card text-foreground" : "bg-paper text-ink",
        borderTone === "border"
          ? "border-border"
          : borderTone === "destructive"
            ? "border-link"
            : "border-ink",
        // Lane T (P1, item 3): one card padding — 16px mobile,
        // 24px desktop, all round. The py-6-only default (no
        // horizontal padding) and the p-3 sm variant are retired.
        "p-4 desktop:p-6",
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
  /** Horizontal padding: "md" is px-4 mobile / px-6 desktop; "none" is p-0 (full-bleed header). */
  padding?: "md" | "none"
  /** Row gap: "sm" is gap-2; "md" is gap-3. */
  gap?: "sm" | "md"
}) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start [.border-b]:pb-6",
        padding === "none" ? "p-0" : "px-4 desktop:px-6",
        gap === "md" ? "gap-3" : "gap-2",
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
        "font-display text-base font-semibold leading-6 text-ink",
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
      className={cn("text-base leading-6 text-ink", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        "px-4 desktop:px-6",
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
  CardContent,
}
