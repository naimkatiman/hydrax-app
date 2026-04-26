import { afterEach } from "vitest";
import { describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ComposabilityRoute } from "./ComposabilityRoute";

afterEach(cleanup);

describe("ComposabilityRoute", () => {
  it("renders the composability heading", () => {
    render(<ComposabilityRoute />);
    expect(screen.getByText(/Composability map/i)).toBeTruthy();
  });

  it("lists at least three contract templates with stakeholders", () => {
    render(<ComposabilityRoute />);
    const cards = screen.getAllByTestId(/contract-card-/);
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("shows which workflow brings each stakeholder onto the contract", () => {
    render(<ComposabilityRoute />);
    expect(screen.getAllByText(/added by/i).length).toBeGreaterThan(0);
  });
});
