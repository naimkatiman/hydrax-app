import type { LucideIcon } from "lucide-react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export interface NavItemLinkProps {
  readonly to: string;
  readonly style?: CSSProperties | undefined;
  readonly onClick?: (() => void) | undefined;
  readonly "aria-current"?: "page" | undefined;
  readonly children?: ReactNode | undefined;
}

interface NavItemProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly active?: boolean;
  readonly badge?: ReactNode;
  readonly href?: string;
  readonly onClick?: () => void;
  readonly linkComponent?: ComponentType<NavItemLinkProps>;
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

export function NavItem({
  icon,
  label,
  active = false,
  badge,
  href,
  onClick,
  linkComponent,
}: NavItemProps) {
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
  const ariaCurrent: "page" | undefined = active ? "page" : undefined;
  if (href) {
    if (linkComponent) {
      const LinkComponent = linkComponent;
      return (
        <LinkComponent to={href} style={style} onClick={onClick} aria-current={ariaCurrent}>
          {content}
        </LinkComponent>
      );
    }
    return (
      <a href={href} style={style} onClick={onClick} aria-current={ariaCurrent}>
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ ...style, border: "none", textAlign: "left", width: "100%" }}
      aria-current={ariaCurrent}
    >
      {content}
    </button>
  );
}
