"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils";

type ProgressProps = ComponentProps<typeof ProgressPrimitive.Root> & {
  variant?: "primary" | "success";
  size?: "sm" | "md";
};

function Progress({
  value,
  variant = "primary",
  size = "md",
  className,
  ...props
}: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value || 0));

  return (
    <ProgressPrimitive.Root
      {...props}
      data-slot="progress"
      value={clampedValue}
      max={100}
      className={cn(
        "relative w-full overflow-hidden rounded-bawa-sm border-2 border-ink bg-paper",
        size === "sm" ? "h-1.5" : "h-2",
        className,
      )}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "h-full w-full rounded-bawa-sm transition-transform duration-300",
          variant === "success" ? "bg-sun" : "bg-coral",
        )}
        style={{
          transform: `translateX(-${100 - clampedValue}%)`,
          transitionTimingFunction: "var(--ease-emphasis)",
        }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
