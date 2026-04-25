import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type StackDirection = "row" | "column";
type StackAlign = "start" | "center" | "end" | "stretch";
type StackJustify = "start" | "center" | "end" | "between" | "around";
type StackGap = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface StackProps extends HTMLAttributes<HTMLDivElement> {
  readonly direction?: StackDirection;
  readonly gap?: StackGap;
  readonly align?: StackAlign;
  readonly justify?: StackJustify;
  readonly wrap?: boolean;
  readonly children?: ReactNode;
}

const ALIGN_MAP: Record<StackAlign, CSSProperties["alignItems"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const JUSTIFY_MAP: Record<StackJustify, CSSProperties["justifyContent"]> = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
  around: "space-around",
};

export function Stack({
  direction = "column",
  gap = "md",
  align = "stretch",
  justify = "start",
  wrap = false,
  style,
  ...rest
}: StackProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: direction,
        gap: `var(--hydrax-space-${gap})`,
        alignItems: ALIGN_MAP[align],
        justifyContent: JUSTIFY_MAP[justify],
        flexWrap: wrap ? "wrap" : "nowrap",
        ...style,
      }}
      {...rest}
    />
  );
}
