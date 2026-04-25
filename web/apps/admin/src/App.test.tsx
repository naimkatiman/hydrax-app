import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (admin)", () => {
  it("renders the AppShell with the portal name and the home heading", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /home/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("stamps data-app-name='admin' on the AppShell wrapper", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-app-name='admin']")).not.toBeNull();
  });
});
