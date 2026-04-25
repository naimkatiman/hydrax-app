import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (investor-portal)", () => {
  it("renders the AppShell with the portal name and the home heading", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Investor Portal")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /home/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("stamps data-app-name='investor-portal' on the AppShell wrapper", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-app-name='investor-portal']")).not.toBeNull();
  });
});
