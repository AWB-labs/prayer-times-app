export interface AppTheme {
  isDark: boolean;
  /** Main screen background */
  bg: string;
  /** Card / surface */
  surface: string;
  /** Elevated surface – next-prayer card, selected cells */
  surface2: string;
  /** Bottom tab-bar background */
  tabBg: string;
  /** Navigation header background */
  navHeader: string;
  /** Subtle border */
  border: string;
  /** Stronger border */
  borderStrong: string;
  /** Primary text */
  text: string;
  /** Secondary / subdued text */
  textSub: string;
  /** Very muted text / labels */
  textMuted: string;
  /** Brand accent colour (#ffc107 in dark, slightly richer in light) */
  accent: string;
  /** Foreground text rendered ON the accent colour */
  accentFg: string;
  /** Translucent accent surface */
  accentSurface: string;
  /** Translucent accent border */
  accentBorder: string;
  /** Expo StatusBar style */
  statusBar: 'light' | 'dark';
}

export const darkTheme: AppTheme = {
  isDark: true,
  bg: '#000000',
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  tabBg: '#1C1C1E',
  navHeader: '#000000',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',
  text: '#ffffff',
  textSub: 'rgba(255,255,255,0.55)',
  textMuted: 'rgba(255,255,255,0.30)',
  accent: '#C9A227',
  accentFg: '#000000',
  accentSurface: 'rgba(201,162,39,0.12)',
  accentBorder: 'rgba(201,162,39,0.35)',
  statusBar: 'light',
};

export const lightTheme: AppTheme = {
  isDark: false,
  bg: '#F2F2F7',
  surface: '#ffffff',
  surface2: '#E5E5EA',
  tabBg: '#ffffff',
  navHeader: '#F2F2F7',
  border: 'rgba(0,0,0,0.08)',
  borderStrong: 'rgba(0,0,0,0.15)',
  text: '#000000',
  textSub: 'rgba(0,0,0,0.55)',
  textMuted: 'rgba(0,0,0,0.30)',
  accent: '#8A6D00',
  accentFg: '#ffffff',
  accentSurface: 'rgba(138,109,0,0.10)',
  accentBorder: 'rgba(138,109,0,0.25)',
  statusBar: 'dark',
};
