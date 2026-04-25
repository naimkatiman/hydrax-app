import type { TenantTheme, TenantThemeTokens } from "./types";

const TOKEN_TO_CSS_VAR: Record<keyof TenantThemeTokens, string> = {
  colorBg: "--hydrax-color-bg",
  colorSurface: "--hydrax-color-surface",
  colorText: "--hydrax-color-text",
  colorTextMuted: "--hydrax-color-text-muted",
  colorBorder: "--hydrax-color-border",
  colorAccent: "--hydrax-color-accent",
  colorAccentSoft: "--hydrax-color-accent-soft",
  colorDanger: "--hydrax-color-danger",
  colorSuccess: "--hydrax-color-success",
  fontSans: "--hydrax-font-sans",
  fontMono: "--hydrax-font-mono",
  radiusSm: "--hydrax-radius-sm",
  radiusMd: "--hydrax-radius-md",
  radiusLg: "--hydrax-radius-lg",
  spaceUnit: "--hydrax-space-unit",
};

export function applyTheme(theme: TenantTheme): void {
  const root = document.documentElement;
  (Object.keys(TOKEN_TO_CSS_VAR) as Array<keyof TenantThemeTokens>).forEach((key) => {
    root.style.setProperty(TOKEN_TO_CSS_VAR[key], theme.tokens[key]);
  });
  root.setAttribute("data-tenant", theme.id);
}
