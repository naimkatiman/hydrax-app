import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { HomeRoute } from "./HomeRoute";

function renderInShell(ui: ReactNode) {
  return render(
    <ThemeProvider theme={DEFAULT_TENANT_THEME}>
      <AppShell appName="investor-portal">{ui}</AppShell>
    </ThemeProvider>,
  );
}

describe("<HomeRoute> (investor-portal)", () => {
  it("renders the Home heading and the investor intro", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText(/Investor workspace/i)).toBeInTheDocument();
  });

  it("renders three stat tiles with placeholder dashes", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("Active subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Holdings")).toBeInTheDocument();
    expect(screen.getByText("Pending notices")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(3);
  });

  it("renders the empty state when not connected", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("No holdings activity yet")).toBeInTheDocument();
    expect(
      screen.getByAltText("Illustration of an empty investor portfolio dashboard"),
    ).toBeInTheDocument();
  });

  it("renders the loading skeleton when connected", () => {
    renderInShell(<HomeRoute connected />);
    expect(screen.queryByText("No holdings activity yet")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Loading/).length).toBeGreaterThan(0);
  });
});
