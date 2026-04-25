import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar } from "./Avatar";

describe("<Avatar>", () => {
  it("renders initials for a two-word name", () => {
    render(<Avatar name="Naim Katiman" />);
    expect(screen.getByLabelText("Avatar for Naim Katiman").textContent).toBe("NK");
  });

  it("renders a single initial for a one-word name", () => {
    render(<Avatar name="Acme" />);
    expect(screen.getByLabelText("Avatar for Acme").textContent).toBe("A");
  });

  it("renders ?? for an empty name", () => {
    render(<Avatar name="" />);
    const el = screen.getByRole("img");
    expect(el.textContent).toBe("??");
  });
});
