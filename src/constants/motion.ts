import {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  LinearTransition,
  ReduceMotion,
} from 'react-native-reanimated';

/**
 * WICHU 모션 시스템.
 *
 * 시간·스프링·이미지 전환을 한곳에서 관리해 같은 의미의 움직임이 화면마다
 * 달라지지 않게 한다. transform/opacity 중심으로 사용해 UI thread에서 처리한다.
 */
export const motionDuration = {
  instant: 0,
  feedback: 120,
  fast: 160,
  standard: 220,
  emphasized: 280,
  exit: 360,
  ambientRise: 520,
  ambientFall: 620,
  shimmer: 1100,
} as const;

export const motionDelay = {
  stagger: 42,
  sectionStagger: 54,
  maxStaggeredItems: 5,
  ambientFloat: 2400,
  ambientShine: 2800,
  ambientBell: 3000,
  ambientPulse: 3200,
  notificationHold: 3000,
} as const;

export const motionSpring = {
  pressIn: { damping: 18, mass: 0.65, stiffness: 320 },
  pressOut: { damping: 17, mass: 0.72, stiffness: 280 },
  responsive: { damping: 20, mass: 0.82, stiffness: 220 },
  settled: { damping: 19, mass: 0.82, stiffness: 185 },
  sheet: { damping: 23, mass: 0.9, stiffness: 230 },
  tab: { damping: 18, mass: 0.7, stiffness: 260 },
  notification: { damping: 20, mass: 0.76, stiffness: 245 },
  celebration: { damping: 15, mass: 0.8, stiffness: 220 },
} as const;

export const motionScale = {
  press: 0.975,
  tab: 1.045,
  featuredTab: 1.07,
  celebrationFrom: 0.86,
} as const;

/** expo-image fade 시간. 이미지 역할이 같으면 화면이 달라도 같은 값을 쓴다. */
export const imageTransition = {
  icon: motionDuration.feedback,
  thumbnail: 140,
  profile: motionDuration.fast,
  hero: 180,
} as const;

export function resolveMotionDuration(reduceMotion: boolean, value: number) {
  return reduceMotion ? motionDuration.instant : value;
}

/**
 * 목록 진입 모션 프리셋.
 *
 * 화면마다 delay·duration을 따로 적으면 리듬이 어긋나고, 무엇보다
 * `reduceMotion` 지정을 빠뜨리기 쉽다. 여기를 거치면 그럴 수 없다.
 */

/** 목록 항목이 순서대로 부드럽게 나타난다. */
export function listEntering(index: number) {
  return FadeInDown.delay(Math.min(index, motionDelay.maxStaggeredItems) * motionDelay.stagger)
    .duration(motionDuration.standard)
    .reduceMotion(ReduceMotion.System);
}

/** 목록 항목이 사라질 때. 들어올 때보다 빠르게 빠진다. */
export function listExiting() {
  return FadeOut.duration(motionDuration.fast).reduceMotion(ReduceMotion.System);
}

/** 항목이 추가·삭제될 때 남은 항목이 제자리를 찾아가는 움직임. */
export function listLayout() {
  return LinearTransition.springify()
    .damping(motionSpring.responsive.damping)
    .mass(motionSpring.responsive.mass)
    .stiffness(motionSpring.responsive.stiffness)
    .reduceMotion(ReduceMotion.System);
}

/** 화면 안의 새 상태가 기존 레이아웃을 밀어내지 않고 자연스럽게 나타난다. */
export function stateEntering() {
  return FadeIn.duration(motionDuration.fast).reduceMotion(ReduceMotion.System);
}

export function stateExiting() {
  return FadeOut.duration(motionDuration.feedback).reduceMotion(ReduceMotion.System);
}

/** 낱개 메시지는 아래에서 짧게 안착한다. */
export function messageEntering() {
  return FadeInUp.springify()
    .damping(motionSpring.responsive.damping)
    .mass(motionSpring.responsive.mass)
    .stiffness(motionSpring.responsive.stiffness)
    .reduceMotion(ReduceMotion.System);
}

/** 주요 화면 섹션은 최대 5개까지만 짧게 순차 진입한다. */
export function sectionEntering(index: number) {
  return FadeInDown.delay(
    Math.min(index, motionDelay.maxStaggeredItems) * motionDelay.sectionStagger,
  )
    .duration(motionDuration.emphasized)
    .reduceMotion(ReduceMotion.System);
}

/** 세그먼트·카테고리 이동 방향과 콘텐츠 이동 방향을 맞춘다. */
export function categoryEntering(direction: -1 | 1) {
  return (direction > 0 ? FadeInRight : FadeInLeft)
    .duration(motionDuration.standard)
    .reduceMotion(ReduceMotion.System);
}

export function categoryExiting(direction: -1 | 1) {
  return (direction > 0 ? FadeOutLeft : FadeOutRight)
    .duration(motionDuration.fast)
    .reduceMotion(ReduceMotion.System);
}
