import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/utils";
import { BawaIcon } from "./icons";

type StepState = "pending" | "active" | "completed";

type StepCardProps = ComponentProps<"div"> & {
  icon: ReactNode;
  label: string;
  detail?: string;
  state?: StepState;
};

const stateClasses: Record<StepState, string> = {
  pending: "border-ink bg-paper",
  active: "border-coral bg-paper",
  completed: "border-ink bg-sun/20",
};

function StepCard({
  icon,
  label,
  detail,
  state = "pending",
  className,
  ...props
}: StepCardProps) {
  return (
    <div
      {...props}
      data-slot="step-card"
      data-state={state}
      className={cn(
        "flex items-start gap-3 rounded-bawa border-2 p-4 text-ink",
        stateClasses[state],
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-bawa-sm border-2 border-ink text-ink [&_svg]:size-5",
          state === "completed" ? "bg-sun" : "bg-paper",
        )}
      >
        {state === "completed" ? (
          <BawaIcon
            name="check"
            aria-hidden="true"
            className="size-5 text-ink"
          />
        ) : (
          icon
        )}
      </div>
      {' '}
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-ink">
          {state === "active" ? (
            <span className="bawa-marker">{label}</span>
          ) : (
            label
          )}
        </p>
        {' '}
        {detail != null && (
          <p className="mt-1 text-base text-ink">{detail}</p>
        )}
      </div>
    </div>
  );
}

export { StepCard };
