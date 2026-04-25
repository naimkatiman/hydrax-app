import { describe, expect, it, beforeEach } from "vitest";
import { applyTheme } from "./applyTheme";
import { DEFAULT_TENANT_THEME } from "./default-theme";

describe("applyTheme", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("style");
    document.documentElement.removeAttribute("data-tenant");
  });

  it("writes every color token as a --hydrax-color-* CSS variable on :root", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-color-bg")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBg,
    );
    expect(root.style.getPropertyValue("--hydrax-color-bg-raised")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorBgRaised,
    );
    expect(root.style.getPropertyValue("--hydrax-color-text-strong")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorTextStrong,
    );
    expect(root.style.getPropertyValue("--hydrax-color-focus-ring")).toBe(
      DEFAULT_TENANT_THEME.tokens.colorFocusRing,
    );
  });

  it("writes every typography token as a --hydrax-type-* CSS variable", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-type-display-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeDisplaySize,
    );
    expect(root.style.getPropertyValue("--hydrax-type-h1-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeH1Size,
    );
    expect(root.style.getPropertyValue("--hydrax-type-body-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeBodySize,
    );
    expect(root.style.getPropertyValue("--hydrax-type-mono-size")).toBe(
      DEFAULT_TENANT_THEME.tokens.typeMonoSize,
    );
  });

  it("writes spacing, shadow, and motion tokens", () => {
    applyTheme(DEFAULT_TENANT_THEME);
    const root = document.documentElement;
    expect(root.style.getPropertyValue("--hydrax-space-md")).toBe(
      DEFAULT_TENANT_THEME.tokens.spaceMd,
    );
    expect(root.style.getPropertyValue("--hydrax-space-2xl")).toBe(
      DEFAULT_TENANT_THEME.tokens.space2xl,
    );
    expect(root.style.getPropertyValue("--hydrax-shadow-sm")).toBe(
      DEFAULT_TENANT_THEME.tokens.shadowSm,
    );
    expect(root.style.getPropertyValue("--hydrax-motion-medium")).toBe(
      DEFAULT_TENANT_THEME.tokens.motionMedium,
    );
    expect(root.style.getPropertyValue("--hydrax-ease-out")).toBe(
      DEFAULT_TENANT_THEME.tokens.easeOut,
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
