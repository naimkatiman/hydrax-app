export interface TenantTheme {
  readonly id: string;
  readonly name: string;
  readonly tokens: TenantThemeTokens;
}

export interface TenantThemeTokens {
  readonly colorBg: string;
  readonly colorSurface: string;
  readonly colorText: string;
  readonly colorTextMuted: string;
  readonly colorBorder: string;
  readonly colorAccent: string;
  readonly colorAccentSoft: string;
  readonly colorDanger: string;
  readonly colorSuccess: string;
  readonly fontSans: string;
  readonly fontMono: string;
  readonly radiusSm: string;
  readonly radiusMd: string;
  readonly radiusLg: string;
  readonly spaceUnit: string;
}
