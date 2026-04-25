import {
  Settings,
  LayoutDashboard,
  Workflow,
  Timer,
  AlertTriangle,
  Activity,
  History,
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavItem, type NavItemLinkProps } from "@hydrax/ui";

interface OpsSidebarProps {
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
  { label: "Workflows", path: "/workflows", icon: Workflow },
  { label: "SLAs", path: "/slas", icon: Timer },
  { label: "Incidents", path: "/incidents", icon: AlertTriangle },
  { label: "Health", path: "/health", icon: Activity },
  { label: "Audit", path: "/audit", icon: History },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function OpsSidebar({ currentPath }: OpsSidebarProps) {
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

export function OpsBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Settings aria-label="Ops Console" role="img" size={16} />
      <span>Ops Console</span>
    </span>
  );
}
