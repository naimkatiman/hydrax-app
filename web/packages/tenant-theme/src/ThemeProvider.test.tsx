import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { DEFAULT_TENANT_THEME } from "./default-theme";

function ThemeReadout() {
  const theme = useTheme();
  return <span data-testid="tenant-id">{theme.id}</span>;
}

describe("<ThemeProvider>", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-tenant");
  });

  it("applies the theme on mount and exposes it via useTheme()", () => {
    render(
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ThemeReadout />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("tenant-id").textContent).toBe("default");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("default");
    expect(document.documentElement.style.getPropertyValue("--hydrax-color-bg")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBg,
    );
  });

  it("re-applies when the theme prop changes", () => {
    const { rerender } = render(
      <ThemeProvider theme={DEFAULT_TENANT_THEME}>
        <ThemeReadout />
      </ThemeProvider>,
    );
    rerender(
      <ThemeProvider theme={{ ...DEFAULT_TENANT_THEME, id: "acme" }}>
        <ThemeReadout />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("tenant-id").textContent).toBe("acme");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("acme");
  });
});
