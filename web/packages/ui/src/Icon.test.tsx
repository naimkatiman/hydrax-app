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

interface FakeAnimatedIconProps {
  readonly className?: string;
  readonly size?: number;
}

function FakeAnimatedIcon({ className, size }: FakeAnimatedIconProps) {
  return <svg data-testid="fake-animated" width={size} height={size} className={className} />;
}

describe("<Icon> (animated branch)", () => {
  it("wraps an animated icon with aria-label and role=img", () => {
    render(<Icon icon={FakeAnimatedIcon} label="Animated" animated size={20} />);
    const wrapper = screen.getByRole("img", { name: "Animated" });
    expect(wrapper).toBeInTheDocument();
    const inner = wrapper.querySelector("[data-testid=fake-animated]");
    expect(inner).toHaveAttribute("width", "20");
    expect(inner).toHaveAttribute("height", "20");
  });

  it("does not double-render aria-label on the inner animated component", () => {
    render(<Icon icon={FakeAnimatedIcon} label="Animated" animated />);
    const labelled = screen.getAllByLabelText("Animated");
    expect(labelled).toHaveLength(1);
  });
});
