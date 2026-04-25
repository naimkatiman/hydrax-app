import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Skeleton } from "./Skeleton";

describe("<Skeleton>", () => {
  it("renders with role=status and aria-busy=true for screen readers", () => {
    render(<Skeleton />);
    const el = screen.getByRole("status");
    expect(el.getAttribute("aria-busy")).toBe("true");
    expect(el.getAttribute("aria-label")).toBe("Loading");
  });

  it("supports custom aria-label", () => {
    render(<Skeleton aria-label="Loading stat tile" />);
    expect(screen.getByRole("status").getAttribute("aria-label")).toBe("Loading stat tile");
  });

  it("supports numeric and string width/height", () => {
    const { rerender } = render(<Skeleton width={200} height={24} />);
    let el = screen.getByRole("status");
    expect(el.style.width).toBe("200px");
    expect(el.style.height).toBe("24px");
    rerender(<Skeleton width="50%" height="2rem" />);
    el = screen.getByRole("status");
    expect(el.style.width).toBe("50%");
    expect(el.style.height).toBe("2rem");
  });
});
