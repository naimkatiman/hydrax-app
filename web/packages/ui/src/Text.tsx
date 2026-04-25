import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type TextSize = "body" | "bodySm";
type TextTone = "default" | "muted" | "strong" | "danger" | "success";
type TextFamily = "sans" | "mono";

interface TextProps extends HTMLAttributes<HTMLSpanElement> {
  readonly size?: TextSize;
  readonly tone?: TextTone;
  readonly family?: TextFamily;
  readonly as?: "span" | "p" | "div";
  readonly children?: ReactNode;
}

const SIZE_MAP: Record<TextSize, { size: string; lineHeight: string }> = {
  body: {
    size: "var(--hydrax-type-body-size)",
    lineHeight: "var(--hydrax-type-body-line-height)",
  },
  bodySm: {
    size: "var(--hydrax-type-body-sm-size)",
    lineHeight: "var(--hydrax-type-body-sm-line-height)",
  },
};

const TONE_MAP: Record<TextTone, CSSProperties["color"]> = {
  default: "var(--hydrax-color-text)",
  muted: "var(--hydrax-color-text-muted)",
  strong: "var(--hydrax-color-text-strong)",
  danger: "var(--hydrax-color-danger)",
  success: "var(--hydrax-color-success)",
};

export function Text({
  size = "body",
  tone = "default",
  family = "sans",
  as = "span",
  style,
  ...rest
}: TextProps) {
  const Tag = as;
  const tokens = SIZE_MAP[size];
  return (
    <Tag
      style={{
        margin: 0,
        fontFamily:
          family === "mono" ? "var(--hydrax-font-mono)" : "var(--hydrax-font-sans)",
        fontSize:
          family === "mono" ? "var(--hydrax-type-mono-size)" : tokens.size,
        lineHeight: tokens.lineHeight,
        color: TONE_MAP[tone],
        ...style,
      }}
      {...rest}
    />
  );
}
