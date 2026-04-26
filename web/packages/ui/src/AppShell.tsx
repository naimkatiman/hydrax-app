import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

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
.hydrax-app-shell-hamburger {
  display: none;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--hydrax-radius-sm);
  color: var(--hydrax-color-text-strong);
  cursor: pointer;
  flex: 0 0 auto;
}
.hydrax-app-shell-hamburger:hover {
  border-color: var(--hydrax-color-border);
  background: var(--hydrax-color-surface);
}
.hydrax-app-shell-hamburger:focus-visible {
  outline: 2px solid var(--hydrax-color-focus-ring);
  outline-offset: 2px;
}
.hydrax-app-shell-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 40;
}
@media (max-width: 768px) {
  .hydrax-app-shell {
    grid-template-columns: 1fr;
    grid-template-areas: "topbar" "main";
  }
  .hydrax-app-shell-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: min(280px, 84vw);
    z-index: 50;
    transform: translateX(-100%);
    transition: transform var(--hydrax-motion-medium) var(--hydrax-ease-out);
    box-shadow: var(--hydrax-shadow-md);
  }
  .hydrax-app-shell[data-sidebar-open="true"] .hydrax-app-shell-sidebar {
    transform: translateX(0);
  }
  .hydrax-app-shell[data-sidebar-open="true"] .hydrax-app-shell-backdrop {
    display: block;
  }
  .hydrax-app-shell-hamburger {
    display: inline-flex;
  }
}
@media (max-width: 600px) {
  .hydrax-app-shell-main {
    padding: var(--hydrax-space-md);
  }
  .hydrax-app-shell-topbar {
    padding: 0 var(--hydrax-space-md);
    gap: var(--hydrax-space-sm);
  }
  [data-mobile-collapse="search-label"] > span[aria-hidden] {
    display: none;
  }
  [data-mobile-collapse="search-label"] {
    flex: 0 0 auto !important;
    max-width: none !important;
    padding: 6px !important;
  }
}
@media (max-width: 480px) {
  [data-mobile-collapse="persona-label"] {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hydrax-app-shell-sidebar {
    transition: none;
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

function HamburgerIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

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
  const showHamburger = hasSidebar && hasTopbar;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const previousBodyOverflow = useRef<string | null>(null);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeSidebar();
    };
    document.addEventListener("keydown", onKey);
    previousBodyOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousBodyOverflow.current ?? "";
      previousBodyOverflow.current = null;
    };
  }, [sidebarOpen, closeSidebar]);

  const handleSidebarClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("a, button, [role='link'], [role='menuitem']")) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <div
      data-app-name={appName}
      data-no-sidebar={hasSidebar ? undefined : "true"}
      data-no-topbar={hasTopbar ? undefined : "true"}
      data-sidebar-open={sidebarOpen ? "true" : undefined}
      className="hydrax-app-shell"
    >
      <style>{SHELL_STYLES}</style>
      {hasSidebar ? (
        <aside
          id="hydrax-sidebar"
          className="hydrax-app-shell-sidebar"
          onClick={handleSidebarClick}
        >
          {brand ? <div style={sidebarBrandStyle}>{brand}</div> : null}
          {sidebar ? <nav style={sidebarBodyStyle}>{sidebar}</nav> : null}
          {sidebarFooter ? <div style={sidebarFooterStyle}>{sidebarFooter}</div> : null}
        </aside>
      ) : null}
      {hasSidebar ? (
        <div
          role="presentation"
          className="hydrax-app-shell-backdrop"
          onClick={closeSidebar}
        />
      ) : null}
      {hasTopbar ? (
        <header role="banner" className="hydrax-app-shell-topbar">
          {showHamburger ? (
            <button
              type="button"
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={sidebarOpen}
              aria-controls="hydrax-sidebar"
              className="hydrax-app-shell-hamburger"
              onClick={() => setSidebarOpen((open) => !open)}
            >
              <HamburgerIcon />
            </button>
          ) : null}
          {topbar}
        </header>
      ) : null}
      <main className="hydrax-app-shell-main">{children}</main>
    </div>
  );
}
