import {
  Network,
  LayoutDashboard,
  Briefcase,
  Users,
  FileSignature,
  Receipt,
  History,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavItem, type NavItemLinkProps } from "@hydrax/ui";

interface DistributorSidebarProps {
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
  { label: "Allocations", path: "/allocations", icon: Briefcase },
  { label: "Investors", path: "/investors", icon: Users },
  { label: "Subscriptions", path: "/subscriptions", icon: FileSignature },
  { label: "Settlements", path: "/settlements", icon: Receipt },
  { label: "Activity", path: "/activity", icon: History },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function DistributorSidebar({ currentPath }: DistributorSidebarProps) {
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

export function DistributorBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Network aria-label="Distributor Portal" role="img" size={16} />
      <span>Distributor Portal</span>
    </span>
  );
}
