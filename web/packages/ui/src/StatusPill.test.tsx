import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./StatusPill";

describe("<StatusPill>", () => {
  it("renders the human label for each lifecycle state", () => {
    const { rerender } = render(<StatusPill state="pending" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
    rerender(<StatusPill state="approved" />);
    expect(screen.getByText("Approved")).toBeInTheDocument();
    rerender(<StatusPill state="active" />);
    expect(screen.getByText("Active")).toBeInTheDocument();
    rerender(<StatusPill state="matured" />);
    expect(screen.getByText("Matured")).toBeInTheDocument();
    rerender(<StatusPill state="cancelled" />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });

  it("exposes the state via data-state for styling and tests", () => {
    render(<StatusPill state="active" />);
    const pill = screen.getByTestId("status-pill");
    expect(pill.getAttribute("data-state")).toBe("active");
  });

  it("renders an aria-labelled icon per state", () => {
    render(<StatusPill state="approved" />);
    expect(
      screen.getByRole("img", { name: /approved status/i }),
    ).toBeInTheDocument();
  });

  it("renders a breathing dot only on the 'active' state", () => {
    const { rerender } = render(<StatusPill state="pending" />);
    expect(screen.queryByTestId("status-pill-pulse")).toBeNull();
    rerender(<StatusPill state="active" />);
    expect(screen.getByTestId("status-pill-pulse")).toBeInTheDocument();
    rerender(<StatusPill state="cancelled" />);
    expect(screen.queryByTestId("status-pill-pulse")).toBeNull();
  });

  it("falls back gracefully on unknown states", () => {
    render(<StatusPill state={"frozen" as unknown as "pending"} />);
    expect(screen.getByTestId("status-pill")).toHaveTextContent(/frozen/i);
  });
});
