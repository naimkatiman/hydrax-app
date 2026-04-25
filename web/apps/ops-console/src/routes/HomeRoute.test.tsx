import { describe, it, expect } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, DEFAULT_TENANT_THEME } from "@hydrax/tenant-theme";
import { AppShell } from "@hydrax/ui";
import { HomeRoute } from "./HomeRoute";

function renderInShell(ui: ReactNode) {
  return render(
    <ThemeProvider theme={DEFAULT_TENANT_THEME}>
      <AppShell appName="ops-console">{ui}</AppShell>
    </ThemeProvider>,
  );
}

describe("<HomeRoute> (ops-console)", () => {
  it("renders the Home heading and the ops intro", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByRole("heading", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByText(/Operations console/i)).toBeInTheDocument();
  });

  it("renders three stat tiles with placeholder dashes", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("Active workflows")).toBeInTheDocument();
    expect(screen.getByText("SLAs at risk")).toBeInTheDocument();
    expect(screen.getByText("Open incidents")).toBeInTheDocument();
    expect(screen.getAllByText("--").length).toBeGreaterThanOrEqual(3);
  });

  it("renders the empty state when not connected", () => {
    renderInShell(<HomeRoute />);
    expect(screen.getByText("No operational events yet")).toBeInTheDocument();
    expect(
      screen.getByAltText("Illustration of an empty operations console"),
    ).toBeInTheDocument();
  });

  it("renders the loading skeleton when connected", () => {
    renderInShell(<HomeRoute connected />);
    expect(screen.queryByText("No operational events yet")).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/Loading/).length).toBeGreaterThan(0);
  });
});
