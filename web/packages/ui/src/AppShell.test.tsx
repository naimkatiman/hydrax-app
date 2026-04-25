import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "./AppShell";

describe("<AppShell>", () => {
  it("renders sidebar, topbar, and main regions with provided children", () => {
    render(
      <AppShell
        appName="test-app"
        sidebar={<nav data-testid="sb">SB</nav>}
        topbar={<header data-testid="tb">TB</header>}
      >
        <p data-testid="content">hello</p>
      </AppShell>,
    );
    expect(screen.getByTestId("sb")).toBeInTheDocument();
    expect(screen.getByTestId("tb")).toBeInTheDocument();
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("applies the application name to the root via data-app-name", () => {
    render(<AppShell appName="issuer-portal">x</AppShell>);
    const root = screen.getByRole("main").parentElement;
    expect(root?.getAttribute("data-app-name")).toBe("issuer-portal");
  });
});
