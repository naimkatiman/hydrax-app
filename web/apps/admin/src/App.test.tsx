import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (admin)", () => {
  it("renders the AppShell with brand, topbar, and sidebar", () => {
    render(<App />);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getAllByRole("banner").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the polished Home route at /", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Active tenants")).toBeInTheDocument();
  });

  it("applies the admin data-app-name", () => {
    render(<App />);
    const root = screen.getByRole("main").parentElement;
    expect(root?.getAttribute("data-app-name")).toBe("admin");
  });

  it("renders the empty state hero by default", () => {
    render(<App />);
    expect(
      screen.getByAltText("Illustration of an empty administration console"),
    ).toBeInTheDocument();
  });
});
