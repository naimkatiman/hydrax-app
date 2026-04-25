import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("<Button>", () => {
  it("renders its children and forwards onClick", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Submit</Button>);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports a 'primary' and 'secondary' variant via data-variant attr", () => {
    const { rerender } = render(<Button variant="primary">A</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("primary");
    rerender(<Button variant="secondary">A</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("secondary");
  });

  it("disables interaction when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Nope
      </Button>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
