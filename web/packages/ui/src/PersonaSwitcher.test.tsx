import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PersonaSwitcher, DEFAULT_PERSONAS } from "./PersonaSwitcher";

describe("<PersonaSwitcher>", () => {
  it("renders the current persona label", () => {
    render(<PersonaSwitcher current="investor" />);
    expect(screen.getByRole("button", { name: /switch persona/i })).toBeInTheDocument();
    expect(screen.getByText(/investor/i)).toBeInTheDocument();
  });

  it("opens a menu showing every persona on click", () => {
    render(<PersonaSwitcher current="investor" />);
    fireEvent.click(screen.getByRole("button", { name: /switch persona/i }));
    for (const p of DEFAULT_PERSONAS) {
      expect(screen.getAllByText(new RegExp(p.label, "i")).length).toBeGreaterThan(0);
    }
  });

  it("renders an external link with each persona's url", () => {
    render(<PersonaSwitcher current="investor" />);
    fireEvent.click(screen.getByRole("button", { name: /switch persona/i }));
    const distributor = DEFAULT_PERSONAS.find((p) => p.id === "distributor")!;
    const link = screen.getByRole("menuitem", { name: new RegExp(distributor.label, "i") });
    expect(link.getAttribute("href")).toBe(distributor.url);
  });

  it("default URLs use combined-deploy relative paths", () => {
    expect(DEFAULT_PERSONAS.find((p) => p.id === "investor")!.url).toBe("/investor/products");
    expect(DEFAULT_PERSONAS.find((p) => p.id === "distributor")!.url).toBe("/distributor/approvals");
    expect(DEFAULT_PERSONAS.find((p) => p.id === "ops")!.url).toBe("/ops/audit");
  });
});
