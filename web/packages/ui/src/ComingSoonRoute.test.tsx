import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ComingSoonRoute } from "./ComingSoonRoute";

describe("<ComingSoonRoute>", () => {
  it("renders the default title as a level-2 heading", () => {
    render(
      <MemoryRouter initialEntries={["/issuer/settings"]}>
        <ComingSoonRoute />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Not yet implemented" }),
    ).toBeInTheDocument();
  });

  it("displays the current pathname in the body", () => {
    render(
      <MemoryRouter initialEntries={["/admin/tenants"]}>
        <ComingSoonRoute />
      </MemoryRouter>,
    );
    expect(screen.getByText("/admin/tenants")).toBeInTheDocument();
  });

  it("renders the construction icon for a11y", () => {
    render(
      <MemoryRouter initialEntries={["/ops/workflows"]}>
        <ComingSoonRoute />
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("Construction")).toBeInTheDocument();
  });

  it("accepts a custom title override", () => {
    render(
      <MemoryRouter initialEntries={["/distributor/settlements"]}>
        <ComingSoonRoute title="Coming Q3" />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "Coming Q3" }),
    ).toBeInTheDocument();
  });
});
