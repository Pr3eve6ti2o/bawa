import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

// Lane T (P1 UI/UX build, items 3+4): one button system — 3 variants,
// 3 sizes. Lane C (token-verify programme): tailwind-merge is gone, so
// cn() is a plain join and conflicting classes are NOT resolved — the
// last class in the list does not win, the stylesheet order does. The
// Button is therefore built so exactly one class per property is ever
// emitted: the base carries no size, radius, justification or border;
// each size variant carries its own height/padding/gap/radius/
// justification and each colour variant its own border/background.
// Do not re-add a conflicting class to the base, and do not pass one
// via className — use size/variant instead.
//
// Variants (plan §c): Primary (coral — the one action per screen),
// Secondary (paper, hover sun — every other button), Ghost
// (borderless, wavy underline — inline navigation only, never for an
// action that changes state). Deleted: secondary≡outline (merged into
// Secondary), default≡destructive (danger = Primary + the alert icon
// at the call site, not a variant), foreground (use Primary),
// sun as a variant (sun is the *selected* state, not a variant).
// Disabled = 40% opacity + not-allowed cursor, never a dashed border
// (dashed also means "decorative card", so it cannot mean disabled).
//
// Sizes: sm 44px (default, inline/rows/filters), md 48px (default
// for the screen's main action), lg 56px (hero actions: Create a
// wallet, Generate recovery phrase). wrap / wrap-start are NOT extra
// sizes: they are the multi-line form of sm (min-h 44px, grows with
// long labels at 390px). Deleted: hero (→ lg), lg's old 48px slot
// (→ md), default/xs/tall/compact/pill (→ sm), icon/icon-sm (unused).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center font-semibold transition-colors select-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-coral [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-2 border-ink bg-coral text-ink active:scale-[0.98] active:underline active:decoration-wavy active:decoration-sun active:underline-offset-4",
        secondary: "border-2 border-ink bg-paper text-ink enabled:hover:bg-sun",
        ghost:
          "border-0 bg-transparent text-ink underline decoration-wavy decoration-coral underline-offset-4",
      },
      size: {
        sm: "h-11 justify-center gap-2 rounded-bawa px-3 text-sm has-[>svg]:px-2.5",
        md: "h-12 justify-center gap-2 rounded-bawa px-4 text-sm has-[>svg]:px-3",
        lg: "h-14 justify-center gap-2 rounded-bawa px-6 text-base has-[>svg]:px-4",
        wrap: "h-auto min-h-11 justify-center gap-2 rounded-bawa px-4 py-3 text-center text-sm whitespace-normal has-[>svg]:px-3",
        "wrap-start":
          "h-auto min-h-11 justify-start gap-2 rounded-bawa px-4 py-3 text-left text-sm whitespace-normal has-[>svg]:px-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "sm",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  type = "button",
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      type={type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { Button };
