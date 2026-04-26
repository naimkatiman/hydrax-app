import {
  ShieldCheck,
  LayoutDashboard,
  Building2,
  Users,
  KeyRound,
  ScrollText,
  Plug,
  Settings,
  Network,
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavItem, type NavItemLinkProps } from "@hydrax/ui";

interface AdminSidebarProps {
  readonly currentPath: string;
}

function RouterLink({ to, style, onClick, children, ...rest }: NavItemLinkProps) {
  return (
    <Link to={to} style={style} onClick={onClick} {...rest}>
      {children}
    </Link>
  );
}

const NAV: ReadonlyArray<{
  readonly label: string;
  readonly path: string;
  readonly icon: typeof LayoutDashboard;
}> = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Composability", path: "/composability", icon: Network },
  { label: "Tenants", path: "/tenants", icon: Building2 },
  { label: "Users", path: "/users", icon: Users },
  { label: "Roles", path: "/roles", icon: KeyRound },
  { label: "Audit log", path: "/audit", icon: ScrollText },
  { label: "Integrations", path: "/integrations", icon: Plug },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function AdminSidebar({ currentPath }: AdminSidebarProps) {
  return (
    <>
      {NAV.map((item) => (
        <NavItem
          key={item.path}
          icon={item.icon}
          label={item.label}
          href={item.path}
          active={currentPath === item.path}
          linkComponent={RouterLink}
        />
      ))}
    </>
  );
}

export function AdminBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <ShieldCheck aria-label="Admin" role="img" size={16} />
      <span>Admin</span>
    </span>
  );
}
