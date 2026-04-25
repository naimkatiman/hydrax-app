import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { HomeRoute } from "./HomeRoute";

function renderInShell(ui: ReactNode) {
  return render(
    <ThemeProvider theme={DEFAULT_TENANT_THEME}>
      <AppShell appName="distributor-portal">{ui}</AppShell>
    </ThemeProvider>,
  );
}

describe("<HomeRoute> (distributor-portal)", () => {
  it("renders the Home heading and the distributor intro", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText(/Distributor workspace/i)).toBeInTheDocument();
  });

  it("renders three stat tiles with placeholder dashes", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("Live allocations")).toBeInTheDocument();
    expect(screen.getByText("Pending subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Settlements this week")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(3);
  });

  it("renders the empty state when not connected", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("No allocation activity yet")).toBeInTheDocument();
    expect(
      screen.getByAltText("Illustration of an empty distribution dashboard"),
    ).toBeInTheDocument();
  });

  it("renders the loading skeleton when connected", () => {
    renderInShell(<HomeRoute connected />);
    expect(screen.queryByText("No allocation activity yet")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Loading/).length).toBeGreaterThan(0);
  });
});
