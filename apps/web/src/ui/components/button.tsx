import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";
import { BawaIcon } from "./icons";

// Lane C (token-verify programme): tailwind-merge is gone, so cn() is a
// plain join and conflicting classes are NOT resolved — the last class
// in the list does not win, the stylesheet order does. The Button is
// therefore built so exactly one class per property is ever emitted:
// the base carries no size, radius, justification or border; each size
// variant carries its own height/padding/gap/radius/justification and
// each colour variant its own border/background. Do not re-add a
// conflicting class to the base, and do not pass one via className —
// use size/variant instead.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center font-medium transition-colors select-none disabled:pointer-events-none disabled:bg-paper disabled:text-ink disabled:border-dashed disabled:border-ink aria-invalid:border-coral [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-2 border-ink bg-coral text-ink active:scale-[0.98] active:underline active:decoration-wavy active:decoration-sun active:underline-offset-4",
        secondary: "border-2 border-ink bg-paper text-ink hover:bg-sun",
        outline: "border-2 border-ink bg-paper text-ink hover:bg-sun",
        ghost: "border-2 border-ink bg-transparent text-ink hover:bg-sun",
        destructive:
          "border-2 border-ink bg-coral text-ink active:scale-[0.98] active:underline active:decoration-wavy active:decoration-sun active:underline-offset-4",
        foreground: "border-2 border-ink bg-ink text-paper",
        link: "border-0 bg-transparent text-ink bawa-squiggle-underline",
        sun: "border-2 border-ink bg-sun text-ink",
      },
      size: {
        hero: "h-14 justify-center gap-2 rounded-bawa px-8 text-lg has-[>svg]:px-6",
        lg: "h-12 justify-center gap-2 rounded-bawa px-6 text-base has-[>svg]:px-4",
        default:
          "h-10 justify-center gap-2 rounded-bawa px-4 py-2 text-sm has-[>svg]:px-3",
        sm: "h-8 justify-center gap-1.5 rounded-bawa px-3 text-sm has-[>svg]:px-2.5",
        xs: "h-7 justify-center gap-1 rounded-bawa px-2 text-xs has-[>svg]:px-1.5",
        icon: "size-10 justify-center gap-2 rounded-bawa",
        "icon-sm": "size-8 justify-center gap-2 rounded-bawa",
        tall: "h-11 justify-center gap-2 rounded-bawa px-4 py-2 text-sm has-[>svg]:px-3",
        pill: "h-11 justify-center gap-2 rounded-[22px] px-3 text-sm has-[>svg]:px-3",
        wrap: "h-auto justify-center gap-2 rounded-bawa px-4 py-3 text-center text-sm whitespace-normal has-[>svg]:px-3",
        "wrap-start":
          "h-auto justify-start gap-2 rounded-bawa px-4 py-3 text-left text-sm whitespace-normal has-[>svg]:px-3",
        compact:
          "h-9 justify-center gap-2 rounded-bawa px-4 py-2 text-sm has-[>svg]:px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
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
      {!asChild && variant === "destructive" ? (
        <>
          <BawaIcon name="alert" aria-hidden="true" className="text-ink" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants };
