import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "./App";

describe("<App> (issuer-portal)", () => {
  it("renders the AppShell with the brand and the home heading", () => {
    render(<App />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("Issuer Portal")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Home", level: 1 })).toBeInTheDocument();
  });

  it("stamps data-app-name='issuer-portal' on the AppShell wrapper", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-app-name='issuer-portal']")).not.toBeNull();
  });

  it("renders sidebar nav items including Products and Approvals", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /products/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /approvals/i })).toBeInTheDocument();
  });

  it("renders the topbar search placeholder and notifications button", () => {
    render(<App />);
    expect(screen.getByRole("search")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument();
  });
});
