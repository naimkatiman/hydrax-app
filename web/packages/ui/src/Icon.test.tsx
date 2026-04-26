import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Settings } from "lucide-react";
import { Icon } from "./Icon";

describe("<Icon> (lucide branch)", () => {
  it("renders the lucide icon with aria-label", () => {
    render(<Icon icon={Settings} label="Settings" />);
    const el = screen.getByRole("img", { name: "Settings" });
    expect(el).toBeInTheDocument();
  });

  it("forwards size prop to the lucide component", () => {
    const { container } = render(<Icon icon={Settings} label="Settings" size={24} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "24");
    expect(svg).toHaveAttribute("height", "24");
  });
});
