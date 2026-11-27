import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-bawa border-2 bg-paper px-4 py-3 text-base text-ink has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "border-ink",
        destructive: "border-coral [&>svg]:text-link",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

// P3-A (style B): `flat` is the flat shape the recovery-phrase
// screens use — a 1px hairline border + uniform 12px radius via the
// .alert-flat utility (globals.css). It changes width + radius only,
// never the border colour, so the destructive variant keeps its
// coral border. Default stays wobbly until P3-B restyles the
// remaining screens.
function Alert({
  className,
  variant = "default",
  flat = false,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants> & {
  /** Flat shape (P3-A): 1px hairline border, uniform 12px radius. */
  flat?: boolean;
}) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(
        alertVariants({ variant }),
        flat ? "alert-flat" : undefined,
        className,
      )}
      {...props}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-base text-ink [&_p]:leading-6",
        className
      )}
      {...props}
    />
  )
}

export { Alert, AlertDescription }
