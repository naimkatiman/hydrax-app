import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("<AppShell>", () => {
  it("renders sidebar, topbar, and main regions with provided children", () => {
    render(
      <AppShell
        appName="test-app"
        brand={<span data-testid="brand">B</span>}
        sidebar={<span data-testid="sb">SB</span>}
        topbar={<span data-testid="tb">TB</span>}
      >
        <p data-testid="content">hello</p>
      </AppShell>,
    );
    expect(screen.getByTestId("brand")).toBeInTheDocument();
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(screen.getByTestId("tb")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("banner")).toBeInTheDocument();
  });

  it("applies the application name to the root via data-app-name", () => {
    render(<AppShell appName="issuer-portal">x</AppShell>);
    const root = screen.getByRole("main").parentElement;
    expect(root?.getAttribute("data-app-name")).toBe("issuer-portal");
  });

  it("renders a sidebar (no brand) when only sidebar is provided", () => {
    render(
      <AppShell appName="x" sidebar={<span data-testid="sb">SB</span>}>
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it("renders sidebarFooter when provided", () => {
    render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebarFooter={<span data-testid="sf">F</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByTestId("sf")).toBeInTheDocument();
  });

  it("renders without sidebar when only topbar is provided", () => {
    render(
      <AppShell appName="x" topbar={<span>tb</span>}>
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("mounts the skeleton shimmer @keyframes globally", () => {
    const { container } = render(
      <AppShell appName="x">
        <span>main</span>
      </AppShell>,
    );
    const styleTag = container.querySelector("style");
    expect(styleTag?.textContent ?? "").toContain("hydrax-skeleton-shimmer");
  });
});
