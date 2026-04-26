import type { CSSProperties, ReactNode } from "react";

interface AppShellProps {
  readonly appName: string;
  readonly brand?: ReactNode;
  readonly topbar?: ReactNode;
  readonly sidebar?: ReactNode;
  readonly sidebarFooter?: ReactNode;
  readonly children: ReactNode;
}

const SHELL_STYLES = `
@keyframes hydrax-skeleton-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
.hydrax-app-shell {
  min-height: 100vh;
  height: 100vh;
  background: var(--hydrax-color-bg);
  color: var(--hydrax-color-text);
  font-family: var(--hydrax-font-sans);
  font-size: var(--hydrax-type-body-size);
  line-height: var(--hydrax-type-body-line-height);
  display: grid;
  grid-template-columns: 240px 1fr;
  grid-template-rows: 56px 1fr;
  grid-template-areas: "sidebar topbar" "sidebar main";
}
.hydrax-app-shell[data-no-sidebar="true"] {
  grid-template-columns: 1fr;
  grid-template-areas: "topbar" "main";
}
.hydrax-app-shell[data-no-topbar="true"] {
  grid-template-rows: 1fr;
}
.hydrax-app-shell[data-no-sidebar="true"][data-no-topbar="true"] {
  grid-template-areas: "main";
}
.hydrax-app-shell-sidebar {
  grid-area: sidebar;
  border-right: 1px solid var(--hydrax-color-border);
  background: var(--hydrax-color-surface);
  display: flex;
  flex-direction: column;
}
.hydrax-app-shell-topbar {
  grid-area: topbar;
  border-bottom: 1px solid var(--hydrax-color-border);
  background: var(--hydrax-color-bg);
  padding: 0 var(--hydrax-space-xl);
  display: flex;
  align-items: center;
  gap: var(--hydrax-space-md);
}
.hydrax-app-shell-main {
  grid-area: main;
  padding: var(--hydrax-space-xl);
  overflow-y: auto;
}
@media (max-width: 768px) {
  .hydrax-app-shell {
    grid-template-columns: 1fr;
    grid-template-areas: "topbar" "main";
  }
  .hydrax-app-shell-sidebar {
    display: none;
  }
}
@media (max-width: 600px) {
  .hydrax-app-shell-main {
    padding: var(--hydrax-space-md);
  }
  .hydrax-app-shell-topbar {
    padding: 0 var(--hydrax-space-md);
  }
}
`;

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
      data-no-sidebar={hasSidebar ? undefined : "true"}
      data-no-topbar={hasTopbar ? undefined : "true"}
      className="hydrax-app-shell"
    >
      <style>{SHELL_STYLES}</style>
      {hasSidebar ? (
        <aside className="hydrax-app-shell-sidebar">
          {brand ? <div style={sidebarBrandStyle}>{brand}</div> : null}
          {sidebar ? <nav style={sidebarBodyStyle}>{sidebar}</nav> : null}
          {sidebarFooter ? <div style={sidebarFooterStyle}>{sidebarFooter}</div> : null}
        </aside>
      ) : null}
      {hasTopbar ? (
        <header role="banner" className="hydrax-app-shell-topbar">
          {topbar}
        </header>
      ) : null}
      <main className="hydrax-app-shell-main">{children}</main>
    </div>
  );
}
