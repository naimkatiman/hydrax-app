import {
  Wallet,
  LayoutDashboard,
  Boxes,
  FileSignature,
  PieChart,
  FileText,
  Bell,
  Activity,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { NavItem, type NavItemLinkProps } from "@hydrax/ui";

interface InvestorSidebarProps {
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
  { label: "Products", path: "/products", icon: Boxes },
  { label: "Subscriptions", path: "/subscriptions", icon: FileSignature },
  { label: "Holdings", path: "/holdings", icon: PieChart },
  { label: "Statements", path: "/statements", icon: FileText },
  { label: "Notices", path: "/notices", icon: Bell },
  { label: "Health", path: "/health", icon: Activity },
  { label: "Settings", path: "/settings", icon: Settings },
];

export function InvestorSidebar({ currentPath }: InvestorSidebarProps) {
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

export function InvestorBrand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Wallet aria-label="Investor Portal" role="img" size={16} />
      <span>Investor Portal</span>
    </span>
  );
}
