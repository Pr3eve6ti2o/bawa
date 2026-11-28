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
// (borderless, plain underline — inline navigation only, never for an
// action that changes state). P3-B: the ghost's wavy coral underline
// and the primary's wavy press underline are gone (style B — no
// squiggle underlines anywhere); the ghost underlines plainly in ink.
// Deleted: secondary≡outline (merged into Secondary),
// default≡destructive (danger = Primary + the alert icon
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
          "border-2 border-ink bg-coral text-ink active:scale-[0.98]",
        secondary: "border-2 border-ink bg-paper text-ink enabled:hover:bg-sun",
        ghost:
          "border-0 bg-transparent text-ink underline underline-offset-4",
      },
      size: {
        sm: "h-11 justify-center gap-2 rounded-flat px-3 text-sm has-[>svg]:px-2.5",
        md: "h-12 justify-center gap-2 rounded-flat px-4 text-sm has-[>svg]:px-3",
        lg: "h-14 justify-center gap-2 rounded-flat px-6 text-base has-[>svg]:px-4",
        wrap: "h-auto min-h-11 justify-center gap-2 rounded-flat px-4 py-3 text-center text-sm whitespace-normal has-[>svg]:px-3",
        "wrap-start":
          "h-auto min-h-11 justify-start gap-2 rounded-flat px-4 py-3 text-left text-sm whitespace-normal has-[>svg]:px-3",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "sm",
    },
  },
);

// P3-A (style B): `flat` is the flat shape the recovery-phrase
// screens use — a 1px hairline border + uniform 10px radius via the
// .btn-flat utility (globals.css), no wavy press underline. It is a
// prop, not a className, so no conflicting class is ever passed: the
// variant utilities still emit their own radius/border and .btn-flat
// (same layer, later in file) wins. P3-B: flat defaults to true —
// every Button in the app is flat unless a call site opts out with
// flat={false} (the QR card's buttons, which own the wobble, do not
// use this component at all). Ghost gets .btn-flat-ghost (radius
// only): ghost is borderless by contract and .btn-flat would add a
// border, but the size variant's rounded-flat still shows on the
// :focus-visible outline without it.
function Button({
  className,
  variant,
  size,
  flat = true,
  asChild = false,
  type = "button",
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Flat shape (P3-B default): 1px hairline border, uniform 10px radius. */
    flat?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      type={type}
      className={cn(
        buttonVariants({ variant, size, className }),
        // P3-B: ghost gets .btn-flat-ghost (radius only) — it is
        // borderless by contract, so .btn-flat would add a border,
        // but the size variant's rounded-flat still shows on the
        // :focus-visible outline, which follows the border radius.
        flat ? (variant === "ghost" ? "btn-flat-ghost" : "btn-flat") : undefined,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export { Button };
