export const palette = {
  ink: '#17171C',
  inkMuted: '#6F7079',
  paper: '#F7F7FA',
  white: '#FFFFFF',
  violet: '#7559F2',
  violetDark: '#5E43DA',
  coral: '#FF8066',
  mint: '#4CC8A3',
  line: '#E8E7ED',
  danger: '#E95464',
  dark: '#111116',
  darkSurface: '#1C1C23',
  darkLine: '#303039',
  darkMuted: '#A8A8B2',
} as const;

export const lightTheme = {
  isDark: false,
  colors: {
    background: palette.paper,
    surface: palette.white,
    text: palette.ink,
    textMuted: palette.inkMuted,
    border: palette.line,
    primary: palette.violet,
    primaryPressed: palette.violetDark,
    accent: palette.coral,
    success: palette.mint,
    danger: palette.danger,
    tabInactive: '#9B9CA5',
    overlay: 'rgba(12, 12, 16, 0.42)',
  },
} as const;

export const darkTheme = {
  isDark: true,
  colors: {
    background: palette.dark,
    surface: palette.darkSurface,
    text: palette.white,
    textMuted: palette.darkMuted,
    border: palette.darkLine,
    primary: '#937CFF',
    primaryPressed: palette.violet,
    accent: '#FF947E',
    success: '#64D9B6',
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
