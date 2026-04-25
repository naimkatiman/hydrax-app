import type { CSSProperties } from "react";

interface SkeletonProps {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly radius?: "sm" | "md" | "lg";
  readonly style?: CSSProperties;
  readonly "aria-label"?: string;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = "sm",
  style,
  "aria-label": ariaLabel = "Loading",
}: SkeletonProps) {
  return (
    <span
      role="status"
      aria-label={ariaLabel}
      aria-busy="true"
      style={{
        display: "inline-block",
        width: typeof width === "number" ? `${width}px` : width,
        height: typeof height === "number" ? `${height}px` : height,
        borderRadius: `var(--hydrax-radius-${radius})`,
        background:
          "linear-gradient(90deg, var(--hydrax-color-surface) 0%, var(--hydrax-color-bg-raised) 50%, var(--hydrax-color-surface) 100%)",
        backgroundSize: "200% 100%",
        animation:
          "hydrax-skeleton-shimmer var(--hydrax-motion-medium) ease-in-out infinite alternate",
        ...style,
      }}
    />
  );
}
