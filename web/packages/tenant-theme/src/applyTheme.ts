import type { TenantTheme, TenantThemeTokens } from "./types";

const TOKEN_TO_CSS_VAR: Record<keyof TenantThemeTokens, string> = {
  colorBg: "--hydrax-color-bg",
  colorBgRaised: "--hydrax-color-bg-raised",
  colorSurface: "--hydrax-color-surface",
  colorText: "--hydrax-color-text",
  colorTextStrong: "--hydrax-color-text-strong",
  colorTextMuted: "--hydrax-color-text-muted",
  colorBorder: "--hydrax-color-border",
  colorAccent: "--hydrax-color-accent",
  colorAccentSoft: "--hydrax-color-accent-soft",
  colorFocusRing: "--hydrax-color-focus-ring",
  colorDanger: "--hydrax-color-danger",
  colorSuccess: "--hydrax-color-success",
  colorWarning: "--hydrax-color-warning",

  fontSans: "--hydrax-font-sans",
  fontMono: "--hydrax-font-mono",

  typeDisplaySize: "--hydrax-type-display-size",
  typeDisplayLineHeight: "--hydrax-type-display-line-height",
  typeDisplayWeight: "--hydrax-type-display-weight",
  typeH1Size: "--hydrax-type-h1-size",
  typeH1LineHeight: "--hydrax-type-h1-line-height",
  typeH1Weight: "--hydrax-type-h1-weight",
  typeH2Size: "--hydrax-type-h2-size",
  typeH2LineHeight: "--hydrax-type-h2-line-height",
  typeH2Weight: "--hydrax-type-h2-weight",
  typeBodySize: "--hydrax-type-body-size",
  typeBodyLineHeight: "--hydrax-type-body-line-height",
  typeBodySmSize: "--hydrax-type-body-sm-size",
  typeBodySmLineHeight: "--hydrax-type-body-sm-line-height",
  typeMonoSize: "--hydrax-type-mono-size",

  spaceUnit: "--hydrax-space-unit",
  spaceXs: "--hydrax-space-xs",
  spaceSm: "--hydrax-space-sm",
  spaceMd: "--hydrax-space-md",
  spaceLg: "--hydrax-space-lg",
  spaceXl: "--hydrax-space-xl",
  space2xl: "--hydrax-space-2xl",

  radiusSm: "--hydrax-radius-sm",
  radiusMd: "--hydrax-radius-md",
  radiusLg: "--hydrax-radius-lg",

  shadowSm: "--hydrax-shadow-sm",
  shadowMd: "--hydrax-shadow-md",

  motionFast: "--hydrax-motion-fast",
  motionMedium: "--hydrax-motion-medium",
  easeOut: "--hydrax-ease-out",
};

export function applyTheme(theme: TenantTheme): void {
  const root = document.documentElement;
  (Object.keys(TOKEN_TO_CSS_VAR) as Array<keyof TenantThemeTokens>).forEach((key) => {
    root.style.setProperty(TOKEN_TO_CSS_VAR[key], theme.tokens[key]);
  });
  root.setAttribute("data-tenant", theme.id);
}
