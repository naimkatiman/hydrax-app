import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Text } from "./Text";

describe("<Text>", () => {
  it("renders a <span> by default", () => {
    render(<Text>hello</Text>);
    const el = screen.getByText("hello");
    expect(el.tagName).toBe("SPAN");
  });

  it("renders a <p> when as='p'", () => {
    render(<Text as="p">paragraph</Text>);
    const el = screen.getByText("paragraph");
    expect(el.tagName).toBe("P");
  });

  it("uses muted color when tone='muted'", () => {
    render(<Text tone="muted">muted</Text>);
    expect(screen.getByText("muted").style.color).toBe("var(--hydrax-color-text-muted)");
  });

  it("uses mono font + mono size when family='mono'", () => {
    render(<Text family="mono">123.45</Text>);
    const el = screen.getByText("123.45");
    expect(el.style.fontFamily).toBe("var(--hydrax-font-mono)");
    expect(el.style.fontSize).toBe("var(--hydrax-type-mono-size)");
  });
});
