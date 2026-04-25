import type { ReactNode } from "react";

interface AppShellProps {
  readonly appName: string;
  readonly sidebar?: ReactNode;
  readonly topbar?: ReactNode;
  readonly children: ReactNode;
}

export function AppShell({ appName, sidebar, topbar, children }: AppShellProps) {
  return (
    <div
      data-app-name={appName}
      style={{
        minHeight: "100vh",
        background: "var(--hydrax-color-bg)",
        color: "var(--hydrax-color-text)",
        fontFamily: "var(--hydrax-font-sans)",
        display: "grid",
        gridTemplateColumns: sidebar ? "240px 1fr" : "1fr",
        gridTemplateRows: topbar ? "56px 1fr" : "1fr",
        gridTemplateAreas: sidebar
          ? topbar
            ? `"sidebar topbar" "sidebar main"`
            : `"sidebar main"`
          : topbar
            ? `"topbar" "main"`
            : `"main"`,
      }}
    >
      {sidebar ? (
        <aside
          style={{
            gridArea: "sidebar",
            borderRight: "1px solid var(--hydrax-color-border)",
            padding: 16,
          }}
        >
          {sidebar}
        </aside>
      ) : null}
      {topbar ? (
        <header
          role="banner"
          style={{
            gridArea: "topbar",
            borderBottom: "1px solid var(--hydrax-color-border)",
            padding: "0 16px",
            display: "flex",
            alignItems: "center",
          }}
        >
          {topbar}
        </header>
      ) : null}
      <main style={{ gridArea: "main", padding: 24 }}>{children}</main>
    </div>
  );
}
