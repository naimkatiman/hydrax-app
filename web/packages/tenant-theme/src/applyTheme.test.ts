import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme } from "./applyTheme";
import { DEFAULT_TENANT_THEME } from "./default-theme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-tenant");
  });

  it("writes every token as a --hydrax-* CSS variable on :root", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-color-bg")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBg,
    );
    expect(root.style.getPropertyValue("--hydrax-color-accent")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorAccent,
    );
    expect(root.style.getPropertyValue("--hydrax-font-sans")).toBe(
      DEFAULT_TENANT_THEME.tokens.fontSans,
    );
    expect(root.style.getPropertyValue("--hydrax-radius-md")).toBe(
      DEFAULT_TENANT_THEME.tokens.radiusMd,
    );
  });

  it("stamps data-tenant=<id> on :root for CSS targeting", () => {
    applyTheme({ ...DEFAULT_TENANT_THEME, id: "acme" });
    expect(document.documentElement.getAttribute("data-tenant")).toBe("acme");
  });

  it("overwrites previous token values and updates data-tenant on re-application", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    applyTheme({
      id: "minimal",
      name: "Minimal",
      tokens: { ...DEFAULT_TENANT_THEME.tokens, colorAccent: "red" },
    });
    expect(document.documentElement.style.getPropertyValue("--hydrax-color-accent")).toBe("red");
    expect(document.documentElement.getAttribute("data-tenant")).toBe("minimal");
  });
});
