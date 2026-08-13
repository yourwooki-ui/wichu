export const palette = {
  ink: '#111111',
  inkMuted: '#6F6F76',
  paper: '#EDEDED',
  white: '#FFFFFF',
  pink: '#FF2D6F',
  pinkPressed: '#E92160',
  lime: '#C9FF2E',
  line: '#D7D7DB',
  danger: '#FF5A67',
  black: '#111111',
  trueBlack: '#000000',
  darkSurface: '#111111',
  darkLine: '#2A2A2F',
  darkMuted: '#A8A8B0',
} as const;

export const lightTheme = {
  isDark: false,
  colors: {
    background: palette.paper,
    surface: palette.white,
    text: palette.ink,
    textMuted: palette.inkMuted,
    border: palette.line,
    primary: palette.pink,
    primaryPressed: palette.pinkPressed,
    accent: palette.lime,
    success: palette.lime,
    danger: palette.danger,
    tabInactive: '#9B9CA5',
    overlay: 'rgba(12, 12, 16, 0.42)',
  },
} as const;

export const darkTheme = {
  isDark: true,
  colors: {
    background: palette.trueBlack,
    surface: palette.darkSurface,
    text: palette.white,
    textMuted: palette.darkMuted,
    border: palette.darkLine,
    primary: palette.pink,
    primaryPressed: palette.pinkPressed,
    accent: palette.lime,
    success: palette.lime,
    danger: '#FF7380',
    tabInactive: '#83838E',
    overlay: 'rgba(4, 4, 7, 0.52)',
  },
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export type AppTheme = typeof lightTheme | typeof darkTheme;
