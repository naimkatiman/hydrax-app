import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  readonly title?: ReactNode;
  readonly footer?: ReactNode;
  readonly children?: ReactNode;
}

export function Card({ title, footer, children, style, ...rest }: CardProps) {
  return (
    <section
      style={{
        background: "var(--hydrax-color-surface)",
        color: "var(--hydrax-color-text)",
        border: "1px solid var(--hydrax-color-border)",
        borderRadius: "var(--hydrax-radius-md)",
        padding: 16,
        fontFamily: "var(--hydrax-font-sans)",
        ...style,
      }}
      {...rest}
    >
      {title ? (
        <header style={{ marginBottom: 12, fontWeight: 600 }}>{title}</header>
      ) : null}
      <div>{children}</div>
      {footer ? (
        <footer style={{ marginTop: 12, color: "var(--hydrax-color-text-muted)" }}>
          {footer}
        </footer>
      ) : null}
    </section>
  );
}
