type SquiggleDividerProps = {
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function SquiggleDivider({
  orientation = "horizontal",
  className,
}: SquiggleDividerProps) {
  const isVertical = orientation === "vertical";

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      viewBox={isVertical ? "0 0 8 120" : "0 0 120 8"}
      width={isVertical ? 8 : 120}
      height={isVertical ? 120 : 8}
      preserveAspectRatio="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path
        d={
          isVertical
            ? "M4 1 C1 8 7 14 4 22 S1 36 4 44 S7 58 4 66 S1 80 4 88 S7 104 4 119"
            : "M1 4 C8 1 14 7 22 4 S36 1 44 4 S58 7 66 4 S80 1 88 4 S104 7 119 4"
        }
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
