import type { TenantTheme } from "./types";

export const DEFAULT_TENANT_THEME: TenantTheme = {
  id: "default",
  name: "HydraX Default",
  tokens: {
    colorBg: "hsl(220, 16%, 8%)",
    colorSurface: "hsl(220, 14%, 12%)",
    colorText: "hsl(220, 12%, 92%)",
    colorTextMuted: "hsl(220, 8%, 64%)",
    colorBorder: "hsl(220, 10%, 22%)",
    colorAccent: "hsl(190, 90%, 55%)",
    colorAccentSoft: "hsla(190, 90%, 55%, 0.12)",
    colorDanger: "hsl(0, 72%, 58%)",
    colorSuccess: "hsl(140, 60%, 50%)",
    fontSans:
      "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, sans-serif",
    fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    radiusSm: "4px",
    radiusMd: "8px",
    radiusLg: "12px",
    spaceUnit: "4px",
  },
};
