import type { CSSProperties, ReactNode } from "react";

interface AppShellProps {
  readonly appName: string;
  readonly brand?: ReactNode;
  readonly topbar?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly sidebarFooter?: ReactNode;
  readonly children: ReactNode;
}

const SHIMMER_KEYFRAMES = `
@keyframes hydrax-skeleton-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
`;

const sidebarStyle: CSSProperties = {
  gridArea: "sidebar",
  borderRight: "1px solid var(--hydrax-color-border)",
  background: "var(--hydrax-color-surface)",
  display: "flex",
  flexDirection: "column",
};

const sidebarBrandStyle: CSSProperties = {
  height: 56,
  padding: "0 var(--hydrax-space-lg)",
  display: "flex",
  alignItems: "center",
  borderBottom: "1px solid var(--hydrax-color-border)",
  fontFamily: "var(--hydrax-font-sans)",
  fontWeight: 600,
  color: "var(--hydrax-color-text-strong)",
};

const sidebarBodyStyle: CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "var(--hydrax-space-md)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--hydrax-space-xs)",
};

const sidebarFooterStyle: CSSProperties = {
  padding: "var(--hydrax-space-md) var(--hydrax-space-lg)",
  borderTop: "1px solid var(--hydrax-color-border)",
};

const topbarStyle: CSSProperties = {
  gridArea: "topbar",
  borderBottom: "1px solid var(--hydrax-color-border)",
  background: "var(--hydrax-color-bg)",
  padding: "0 var(--hydrax-space-xl)",
  display: "flex",
  alignItems: "center",
  gap: "var(--hydrax-space-md)",
};

const mainStyle: CSSProperties = {
  gridArea: "main",
  padding: "var(--hydrax-space-xl)",
  overflowY: "auto",
};

export function AppShell({
  appName,
  brand,
  topbar,
  sidebar,
  sidebarFooter,
  children,
}: AppShellProps) {
  const hasSidebar = Boolean(sidebar) || Boolean(brand);
  const hasTopbar = Boolean(topbar);

  return (
    <div
      data-app-name={appName}
      style={{
        minHeight: "100vh",
        height: "100vh",
        background: "var(--hydrax-color-bg)",
        color: "var(--hydrax-color-text)",
        fontFamily: "var(--hydrax-font-sans)",
        fontSize: "var(--hydrax-type-body-size)",
        lineHeight: "var(--hydrax-type-body-line-height)",
        display: "grid",
        gridTemplateColumns: hasSidebar ? "240px 1fr" : "1fr",
        gridTemplateRows: hasTopbar ? "56px 1fr" : "1fr",
        gridTemplateAreas: hasSidebar
          ? hasTopbar
            ? `"sidebar topbar" "sidebar main"`
            : `"sidebar main"`
          : hasTopbar
            ? `"topbar" "main"`
            : `"main"`,
      }}
    >
      <style>{SHIMMER_KEYFRAMES}</style>
      {hasSidebar ? (
        <aside style={sidebarStyle}>
          {brand ? <div style={sidebarBrandStyle}>{brand}</div> : null}
          {sidebar ? <nav style={sidebarBodyStyle}>{sidebar}</nav> : null}
          {sidebarFooter ? <div style={sidebarFooterStyle}>{sidebarFooter}</div> : null}
        </aside>
      ) : null}
      {hasTopbar ? (
        <header role="banner" style={topbarStyle}>
          {topbar}
        </header>
      ) : null}
      <main style={mainStyle}>{children}</main>
    </div>
  );
}
