import * as React from "react"
import { Slot, Slottable } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-bawa-sm border-2 border-ink font-medium text-ink transition-colors [&>svg]:pointer-events-none [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-coral",
        secondary: "bg-paper",
        destructive: "bg-coral",
        outline: "bg-paper",
        primary: "bg-sun",
        success: "bg-sun",
        neutral: "bg-paper",
        positive: "bg-sun",
      },
      size: {
        sm: "gap-1 px-2 py-0.5 text-xs [&>svg]:size-4",
        md: "gap-1.5 px-3 py-1 text-sm [&>svg]:size-4",
        lg: "gap-2 px-4 py-1.5 text-base [&>svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
)

function Badge({
  className,
  variant = "default",
  size = "md",
  icon,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    icon?: React.ReactNode
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-size={size}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {icon}
      <Slottable>{children}</Slottable>
    </Comp>
  )
}

export { Badge }
