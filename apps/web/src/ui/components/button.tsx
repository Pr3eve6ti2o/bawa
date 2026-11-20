import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";
import { BawaIcon } from "./icons";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-bawa border-2 border-ink font-medium transition-colors select-none disabled:pointer-events-none disabled:bg-paper disabled:text-ink disabled:border-dashed disabled:border-ink aria-invalid:border-coral [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-coral text-ink active:scale-[0.98] active:underline active:decoration-wavy active:decoration-sun active:underline-offset-4",
        secondary: "bg-paper text-ink hover:bg-sun",
        outline: "bg-paper text-ink hover:bg-sun",
        ghost: "bg-transparent text-ink hover:bg-sun",
        destructive:
          "bg-coral text-ink active:scale-[0.98] active:underline active:decoration-wavy active:decoration-sun active:underline-offset-4",
        foreground: "bg-ink text-paper",
        link: "border-0 bg-transparent text-ink bawa-squiggle-underline",
      },
      size: {
        hero: "h-14 px-8 text-lg has-[>svg]:px-6",
        lg: "h-12 px-6 text-base has-[>svg]:px-4",
        default: "h-10 px-4 py-2 text-sm has-[>svg]:px-3",
        sm: "h-8 gap-1.5 px-3 text-sm has-[>svg]:px-2.5",
        xs: "h-7 gap-1 px-2 text-xs has-[>svg]:px-1.5",
        icon: "size-10",
        "icon-sm": "size-8",
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
