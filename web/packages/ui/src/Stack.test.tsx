import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Stack } from "./Stack";

describe("<Stack>", () => {
  it("renders its children", () => {
    render(
      <Stack data-testid="stack">
        <span>a</span>
        <span>b</span>
      </Stack>,
    );
    const stack = screen.getByTestId("stack");
    expect(stack).toBeInTheDocument();
    expect(stack.children).toHaveLength(2);
  });

  it("applies CSS variable for the requested gap size", () => {
    const { rerender } = render(<Stack data-testid="stack" gap="lg" />);
    expect(screen.getByTestId("stack").style.gap).toBe("var(--hydrax-space-lg)");
    rerender(<Stack data-testid="stack" gap="2xl" />);
    expect(screen.getByTestId("stack").style.gap).toBe("var(--hydrax-space-2xl)");
  });

  it("supports row direction", () => {
    render(<Stack data-testid="stack" direction="row" />);
    expect(screen.getByTestId("stack").style.flexDirection).toBe("row");
  });
});
