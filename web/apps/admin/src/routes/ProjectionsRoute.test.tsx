import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ProjectionsRoute } from "./ProjectionsRoute";

afterEach(cleanup);

describe("ProjectionsRoute", () => {
  it("renders the projections heading", () => {
    render(<ProjectionsRoute />);
    expect(screen.getByRole("heading", { name: /Projections/i })).toBeTruthy();
  });

  it("renders one row per known projection with store + lag", () => {
    render(<ProjectionsRoute />);
    const rows = screen.getAllByTestId(/projection-row-/);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it("flags projections with non-zero lag distinctly", () => {
    render(<ProjectionsRoute />);
    const lagged = screen.getAllByTestId(/lag-stale/);
    expect(lagged.length).toBeGreaterThan(0);
  });
});
