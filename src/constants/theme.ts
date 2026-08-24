import { Platform, type ViewStyle } from 'react-native';

export const palette = {
  ink: '#111111',
  inkMuted: '#74747C',
  paper: '#F5F5F7',
  white: '#FFFFFF',
  pink: '#FF2D6F',
  pinkPressed: '#E92160',
  lime: '#C9FF2E',
  line: '#E0E0E4',
  danger: '#FF5A67',
  black: '#111111',
  trueBlack: '#000000',
  darkSurface: '#111111',
  darkLine: '#2A2A2F',
  darkMuted: '#A8A8B0',
  /** Gold Pass 표현. 화면마다 제각각이던 금색을 여기서만 정의한다. */
  goldText: '#FFE7A3',
  goldLine: 'rgba(255,211,90,0.7)',
  goldSurface: 'rgba(15,15,18,0.74)',
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

/**
 * 타이포그래피 램프.
 *
 * 화면마다 흩어져 있던 fontSize/fontWeight 조합을 하나의 단계로 모은다.
 * 각 토큰은 `Text` style에 그대로 펼쳐 쓰고, 색은 항상 호출부에서 지정한다.
 */
export const typography = {
  display: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 34 },
  title: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6, lineHeight: 30 },
  heading: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2, lineHeight: 24 },
  subheading: { fontSize: 16, fontWeight: '800', letterSpacing: -0.1, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '500', letterSpacing: 0, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '700', letterSpacing: 0, lineHeight: 21 },
  bodySm: { fontSize: 13, fontWeight: '500', letterSpacing: 0, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0, lineHeight: 16 },
  caption: { fontSize: 11, fontWeight: '600', letterSpacing: 0, lineHeight: 15 },
  overline: { fontSize: 10, fontWeight: '900', letterSpacing: 1.6, lineHeight: 13 },
} as const;

export type TypographyToken = keyof typeof typography;

/**
 * 그림자 프리셋.
 *
 * 기존 화면들은 web `boxShadow`만 지정하고 native 분기를 빠뜨린 곳이 있어
 * iOS/Android에서 카드가 평평하게 보였다. 이 토큰은 항상 두 플랫폼을 함께 정의한다.
 */
function shadow(offsetY: number, blur: number, opacity: number, elevation: number): ViewStyle {
  return Platform.select<ViewStyle>({
    web: { boxShadow: `0 ${offsetY}px ${blur}px rgba(21,20,25,${opacity})` },
    default: {
      elevation,
      shadowColor: '#151419',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur / 2,
    },
  })!;
}

export const elevation = {
  /** 목록 타일, 작은 pill 등 표면에서 살짝 떠 있는 요소 */
  sm: shadow(2, 8, 0.08, 2),
  /** 카드, 섹션 컨테이너 */
  md: shadow(5, 14, 0.09, 4),
  /** Discover 스와이프 카드처럼 화면의 주인공 */
  lg: shadow(10, 24, 0.12, 8),
} as const;

/** 화면 공통 레이아웃. 태블릿·웹에서 본문이 과도하게 늘어나지 않게 한다. */
export const layout = {
  maxContentWidth: 620,
} as const;

/** 모션 duration(ms). 값이 흩어지지 않도록 여기서만 정의한다. */
export const duration = {
  fast: 140,
  base: 220,
  slow: 420,
  /** skeleton shimmer 1회 왕복 */
  shimmer: 1100,
} as const;

/**
 * 터치 영역 확장 프리셋.
 *
 * 시각 크기를 키우지 않고 44pt 최소 터치 영역을 맞출 때 쓴다.
 * `icon`은 20~28px 아이콘 버튼, `link`는 한 줄짜리 텍스트 링크 기준이다.
 */
export const touchSlop = {
  icon: { bottom: 12, left: 12, right: 12, top: 12 },
  link: { bottom: 14, left: 10, right: 10, top: 14 },
  pill: { bottom: 6, left: 4, right: 4, top: 6 },
} as const;

/** Pressable 피드백. 화면마다 0.62~0.98로 제각각이던 값을 통일한다. */
export const pressFeedback: Record<'surface' | 'control' | 'icon', ViewStyle> = {
  /** 카드처럼 면적이 큰 대상 */
  surface: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  /** 버튼, pill */
  control: { opacity: 0.86, transform: [{ scale: 0.97 }] },
  /** 아이콘 버튼처럼 면적이 작은 대상 */
  icon: { opacity: 0.6, transform: [{ scale: 0.94 }] },
};
