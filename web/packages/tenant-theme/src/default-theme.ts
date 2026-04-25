import type { TenantTheme } from "./types";

export const DEFAULT_TENANT_THEME: TenantTheme = {
  id: "default",
  name: "HydraX Default",
  tokens: {
    colorBg: "hsl(220, 16%, 8%)",
    colorBgRaised: "hsl(220, 14%, 14%)",
    colorSurface: "hsl(220, 14%, 12%)",
    colorText: "hsl(220, 12%, 92%)",
    colorTextStrong: "hsl(220, 12%, 98%)",
    colorTextMuted: "hsl(220, 8%, 64%)",
    colorBorder: "hsl(220, 10%, 22%)",
    colorAccent: "hsl(190, 90%, 55%)",
    colorAccentSoft: "hsla(190, 90%, 55%, 0.12)",
    colorFocusRing: "hsla(190, 90%, 55%, 0.45)",
    colorDanger: "hsl(0, 72%, 58%)",
    colorSuccess: "hsl(140, 60%, 50%)",

    fontSans:
      "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",

    typeDisplaySize: "32px",
    typeDisplayLineHeight: "40px",
    typeDisplayWeight: "600",
    typeH1Size: "22px",
    typeH1LineHeight: "28px",
    typeH1Weight: "600",
    typeH2Size: "16px",
    typeH2LineHeight: "22px",
    typeH2Weight: "600",
    typeBodySize: "13px",
    typeBodyLineHeight: "20px",
    typeBodySmSize: "12px",
    typeBodySmLineHeight: "18px",
    typeMonoSize: "13px",

    spaceUnit: "4px",
    spaceXs: "4px",
    spaceSm: "8px",
    spaceMd: "12px",
    spaceLg: "16px",
    spaceXl: "24px",
    space2xl: "32px",

    radiusSm: "4px",
    radiusMd: "8px",
    radiusLg: "12px",

    shadowSm: "0 1px 2px hsla(220, 30%, 4%, 0.45)",
    shadowMd: "0 6px 16px hsla(220, 30%, 4%, 0.5)",

    motionFast: "150ms",
    motionMedium: "250ms",
    easeOut: "cubic-bezier(0.16, 1, 0.3, 1)",
  },
};
