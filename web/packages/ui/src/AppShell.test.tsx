import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
    const styleTags = Array.from(container.querySelectorAll("style"));
    const haveShimmer = styleTags.some((tag) =>
      (tag.textContent ?? "").includes("hydrax-skeleton-shimmer"),
    );
    expect(haveShimmer).toBe(true);
  });

  it("declares a responsive collapse breakpoint that hides the sidebar at small viewports", () => {
    const { container } = render(
      <AppShell appName="x" brand={<span>B</span>} sidebar={<span>SB</span>}>
        <span>main</span>
      </AppShell>,
    );
    const styleTags = Array.from(container.querySelectorAll("style"));
    const haveResponsive = styleTags.some((tag) =>
      (tag.textContent ?? "").includes("@media (max-width: 768px)"),
    );
    expect(haveResponsive).toBe(true);
  });

  it("declares a tighter padding breakpoint at 600px", () => {
    const { container } = render(
      <AppShell appName="x" topbar={<span>tb</span>}>
        <span>main</span>
      </AppShell>,
    );
    const styleTags = Array.from(container.querySelectorAll("style"));
    const haveTight = styleTags.some((tag) =>
      (tag.textContent ?? "").includes("@media (max-width: 600px)"),
    );
    expect(haveTight).toBe(true);
  });

  it("declares an extra-small breakpoint at 480px for persona-label collapse", () => {
    const { container } = render(
      <AppShell appName="x" topbar={<span>tb</span>}>
        <span>main</span>
      </AppShell>,
    );
    const styleTags = Array.from(container.querySelectorAll("style"));
    const haveXs = styleTags.some((tag) =>
      (tag.textContent ?? "").includes("@media (max-width: 480px)"),
    );
    expect(haveXs).toBe(true);
  });

  it("renders a hamburger toggle when sidebar AND topbar are both present", () => {
    render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebar={<span>SB</span>}
        topbar={<span>TB</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    expect(screen.getByLabelText(/open navigation/i)).toBeInTheDocument();
  });

  it("does NOT render a hamburger when only the sidebar is present (no topbar)", () => {
    render(
      <AppShell appName="x" brand={<span>B</span>} sidebar={<span>SB</span>}>
        <span>main</span>
      </AppShell>,
    );
    expect(
      screen.queryByLabelText(/open navigation/i),
    ).not.toBeInTheDocument();
  });

  it("does NOT render a hamburger when only the topbar is present (no sidebar)", () => {
    render(
      <AppShell appName="x" topbar={<span>TB</span>}>
        <span>main</span>
      </AppShell>,
    );
    expect(
      screen.queryByLabelText(/open navigation/i),
    ).not.toBeInTheDocument();
  });

  it("toggles data-sidebar-open on the shell root when the hamburger is clicked", () => {
    render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebar={<span>SB</span>}
        topbar={<span>TB</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    const root = screen.getByRole("main").parentElement!;
    const button = screen.getByLabelText(/open navigation/i);
    expect(root.getAttribute("data-sidebar-open")).toBeNull();

    fireEvent.click(button);
    expect(root.getAttribute("data-sidebar-open")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(button);
    expect(root.getAttribute("data-sidebar-open")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the drawer when ESC is pressed", () => {
    render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebar={<span>SB</span>}
        topbar={<span>TB</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    const root = screen.getByRole("main").parentElement!;
    fireEvent.click(screen.getByLabelText(/open navigation/i));
    expect(root.getAttribute("data-sidebar-open")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(root.getAttribute("data-sidebar-open")).toBeNull();
  });

  it("closes the drawer when a nav link inside the sidebar is clicked", () => {
    render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebar={
          <a data-testid="nav-link" href="/somewhere">
            Somewhere
          </a>
        }
        topbar={<span>TB</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    const root = screen.getByRole("main").parentElement!;
    fireEvent.click(screen.getByLabelText(/open navigation/i));
    expect(root.getAttribute("data-sidebar-open")).toBe("true");

    fireEvent.click(screen.getByTestId("nav-link"));
    expect(root.getAttribute("data-sidebar-open")).toBeNull();
  });

  it("closes the drawer when the backdrop is clicked", () => {
    const { container } = render(
      <AppShell
        appName="x"
        brand={<span>B</span>}
        sidebar={<span>SB</span>}
        topbar={<span>TB</span>}
      >
        <span>main</span>
      </AppShell>,
    );
    const root = screen.getByRole("main").parentElement!;
    fireEvent.click(screen.getByLabelText(/open navigation/i));
    expect(root.getAttribute("data-sidebar-open")).toBe("true");

    const backdrop = container.querySelector(".hydrax-app-shell-backdrop");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(root.getAttribute("data-sidebar-open")).toBeNull();
  });
});
