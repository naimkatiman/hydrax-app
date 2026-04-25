import type { HTMLAttributes, ReactNode } from "react";

type HeadingLevel = "display" | "h1" | "h2";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  readonly level?: HeadingLevel;
  readonly as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  readonly children?: ReactNode;
}

const SIZE_MAP: Record<HeadingLevel, { size: string; lineHeight: string; weight: string }> = {
  display: {
    size: "var(--hydrax-type-display-size)",
    lineHeight: "var(--hydrax-type-display-line-height)",
    weight: "var(--hydrax-type-display-weight)",
  },
  h1: {
    size: "var(--hydrax-type-h1-size)",
    lineHeight: "var(--hydrax-type-h1-line-height)",
    weight: "var(--hydrax-type-h1-weight)",
  },
  h2: {
    size: "var(--hydrax-type-h2-size)",
    lineHeight: "var(--hydrax-type-h2-line-height)",
    weight: "var(--hydrax-type-h2-weight)",
  },
};

export function Heading({ level = "h1", as, style, ...rest }: HeadingProps) {
  const Tag = as ?? (level === "display" ? "h1" : level);
  const tokens = SIZE_MAP[level];
  return (
    <Tag
      style={{
        margin: 0,
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: tokens.size,
        lineHeight: tokens.lineHeight,
        fontWeight: tokens.weight,
        color: "var(--hydrax-color-text-strong)",
        letterSpacing: "-0.01em",
        ...style,
      }}
      {...rest}
    />
  );
}
