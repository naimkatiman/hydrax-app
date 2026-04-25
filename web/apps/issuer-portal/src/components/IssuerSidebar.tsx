import {
  Building2,
  LayoutDashboard,
  Boxes,
  ClipboardCheck,
  Users,
  History,
  Settings,
} from "lucide-react";
import { NavItem } from "@hydrax/ui";

interface IssuerSidebarProps {
  readonly currentPath: string;
}

const NAV: ReadonlyArray<{
  readonly label: string;
  readonly path: string;
  readonly icon: typeof LayoutDashboard;
}> = [
  { label: "Home", path: "/", icon: LayoutDashboard },
  { label: "Products", path: "/products", icon: Boxes },
  { label: "Approvals", path: "/approvals", icon: ClipboardCheck },
  { label: "Investors", path: "/investors", icon: Users },
  { label: "Activity", path: "/activity", icon: History },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function IssuerSidebar({ currentPath }: IssuerSidebarProps) {
  return (
    <>
      {NAV.map((item) => (
        <NavItem
          key={item.path}
          icon={item.icon}
          label={item.label}
          href={item.path}
          active={currentPath === item.path}
        />
      ))}
    </>
  );
}

export function IssuerBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Building2 aria-label="Issuer Portal" role="img" size={16} />
      <span>Issuer Portal</span>
    </span>
  );
}
