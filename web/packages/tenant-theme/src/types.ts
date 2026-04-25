export interface TenantTheme {
  readonly id: string;
  readonly name: string;
  readonly tokens: TenantThemeTokens;
}

export interface TenantThemeTokens {
  readonly colorBg: string;
  readonly colorBgRaised: string;
  readonly colorSurface: string;
  readonly colorText: string;
  readonly colorTextStrong: string;
  readonly colorTextMuted: string;
  readonly colorBorder: string;
  readonly colorAccent: string;
  readonly colorAccentSoft: string;
  readonly colorFocusRing: string;
  readonly colorDanger: string;
  readonly colorSuccess: string;

  readonly fontSans: string;
  readonly fontMono: string;

  readonly typeDisplaySize: string;
  readonly typeDisplayLineHeight: string;
  readonly typeDisplayWeight: string;
  readonly typeH1Size: string;
  readonly typeH1LineHeight: string;
  readonly typeH1Weight: string;
  readonly typeH2Size: string;
  readonly typeH2LineHeight: string;
  readonly typeH2Weight: string;
  readonly typeBodySize: string;
  readonly typeBodyLineHeight: string;
  readonly typeBodySmSize: string;
  readonly typeBodySmLineHeight: string;
  readonly typeMonoSize: string;

  readonly spaceUnit: string;
  readonly spaceXs: string;
  readonly spaceSm: string;
  readonly spaceMd: string;
  readonly spaceLg: string;
  readonly spaceXl: string;
  readonly space2xl: string;

  readonly radiusSm: string;
  readonly radiusMd: string;
  readonly radiusLg: string;

  readonly shadowSm: string;
  readonly shadowMd: string;

  readonly motionFast: string;
  readonly motionMedium: string;
  readonly easeOut: string;
}
