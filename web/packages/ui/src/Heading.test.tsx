import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Heading } from "./Heading";

describe("<Heading>", () => {
  it("renders an <h1> by default for level=h1", () => {
    render(<Heading>Page Title</Heading>);
    expect(screen.getByRole("heading", { level: 1, name: "Page Title" })).toBeInTheDocument();
  });

  it("renders an <h1> for level=display (display is a visual variant, not a semantic level)", () => {
    render(<Heading level="display">Welcome</Heading>);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome" })).toBeInTheDocument();
  });

  it("renders the requested element when `as` is provided", () => {
    render(
      <Heading as="h3" level="h2">
        Section
      </Heading>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Section" })).toBeInTheDocument();
  });

  it("uses h2 type tokens when level=h2", () => {
    render(<Heading level="h2">Subtitle</Heading>);
    const h = screen.getByRole("heading", { level: 2 });
    expect(h.style.fontSize).toBe("var(--hydrax-type-h2-size)");
  });
});
