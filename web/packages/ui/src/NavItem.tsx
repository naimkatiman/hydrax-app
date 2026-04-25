import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

interface NavItemProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly active?: boolean;
  readonly badge?: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
}

const baseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--hydrax-space-sm)",
  padding: "var(--hydrax-space-sm) var(--hydrax-space-md)",
  borderRadius: "var(--hydrax-radius-sm)",
  color: "var(--hydrax-color-text-muted)",
  fontFamily: "var(--hydrax-font-sans)",
  fontSize: "var(--hydrax-type-body-size)",
  lineHeight: "var(--hydrax-type-body-line-height)",
  textDecoration: "none",
  cursor: "pointer",
  transition: "background var(--hydrax-motion-fast) var(--hydrax-ease-out), color var(--hydrax-motion-fast) var(--hydrax-ease-out)",
};

const activeStyle: CSSProperties = {
  background: "var(--hydrax-color-bg-raised)",
  color: "var(--hydrax-color-text-strong)",
};

export function NavItem({ icon, label, active = false, badge, href, onClick }: NavItemProps) {
  const content = (
    <>
      <Icon icon={icon} label={label} size={16} />
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
      {badge ? (
        <span
          style={{
            fontFamily: "var(--hydrax-font-mono)",
            fontSize: "11px",
            color: "var(--hydrax-color-text-muted)",
            padding: "2px 6px",
            borderRadius: "var(--hydrax-radius-sm)",
            background: "var(--hydrax-color-surface)",
            border: "1px solid var(--hydrax-color-border)",
          }}
        >
          {badge}
        </span>
      ) : null}
    </>
  );
  const style = active ? { ...baseStyle, ...activeStyle } : baseStyle;
  if (href) {
    return (
      <a href={href} style={style} aria-current={active ? "page" : undefined}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, border: "none", textAlign: "left", width: "100%" }}
      aria-current={active ? "page" : undefined}
    >
      {content}
    </button>
  );
}
