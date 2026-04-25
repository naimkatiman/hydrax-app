import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HomeRoute } from "./HomeRoute";

describe("<HomeRoute>", () => {
  it("renders the page heading and three stat tiles", () => {
    render(<HomeRoute />);
    expect(screen.getByRole("heading", { level: 1, name: "Home" })).toBeInTheDocument();
    expect(screen.getByText("Products in flight")).toBeInTheDocument();
    expect(screen.getByText("Pending approvals")).toBeInTheDocument();
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("shows the empty-state with hero image when not connected", () => {
    render(<HomeRoute connected={false} />);
    expect(
      screen.getByRole("heading", { level: 2, name: /no activity yet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText("Illustration of an empty institutional dashboard"),
    ).toBeInTheDocument();
  });

  it("shows the loading skeleton when connected=true", () => {
    render(<HomeRoute connected />);
    const skeletons = screen.getAllByRole("status");
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/no activity yet/i)).not.toBeInTheDocument();
  });

  it("renders -- placeholders in stat tiles (no fake data)", () => {
    render(<HomeRoute />);
    const placeholders = screen.getAllByText("--");
    expect(placeholders.length).toBe(3);
  });
});
