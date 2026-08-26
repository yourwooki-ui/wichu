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
 * 목록 진입 모션 프리셋.
 *
 * 화면마다 delay·duration을 따로 적으면 리듬이 어긋나고, 무엇보다
 * `reduceMotion` 지정을 빠뜨리기 쉽다. 여기를 거치면 그럴 수 없다.
 */

/** 항목당 지연(ms). 길면 목록이 느리게 느껴진다. */
const STAGGER_MS = 42;
/** 지연을 주는 최대 항목 수. 그 뒤로는 함께 나타난다. */
const MAX_STAGGERED = 5;

/** 목록 항목이 순서대로 부드럽게 나타난다. */
export function listEntering(index: number) {
  return FadeInDown.delay(Math.min(index, MAX_STAGGERED) * STAGGER_MS)
    .duration(240)
    .reduceMotion(ReduceMotion.System);
}

/** 목록 항목이 사라질 때. 들어올 때보다 빠르게 빠진다. */
export function listExiting() {
  return FadeOut.duration(140).reduceMotion(ReduceMotion.System);
}

/** 항목이 추가·삭제될 때 남은 항목이 제자리를 찾아가는 움직임. */
export function listLayout() {
  return LinearTransition.springify().damping(20).stiffness(160).reduceMotion(ReduceMotion.System);
}

/** 화면 안의 새 상태가 기존 레이아웃을 밀어내지 않고 자연스럽게 나타난다. */
export function stateEntering() {
  return FadeIn.duration(180).reduceMotion(ReduceMotion.System);
}

export function stateExiting() {
  return FadeOut.duration(120).reduceMotion(ReduceMotion.System);
}

/** 낱개 메시지는 아래에서 짧게 안착한다. */
export function messageEntering() {
  return FadeInUp.duration(190).springify().damping(22).reduceMotion(ReduceMotion.System);
}

/** 주요 화면 섹션은 최대 5개까지만 짧게 순차 진입한다. */
export function sectionEntering(index: number) {
  return FadeInDown.delay(Math.min(index, MAX_STAGGERED) * 54)
    .duration(260)
    .reduceMotion(ReduceMotion.System);
}

/** 세그먼트·카테고리 이동 방향과 콘텐츠 이동 방향을 맞춘다. */
export function categoryEntering(direction: -1 | 1) {
  return (direction > 0 ? FadeInRight : FadeInLeft).duration(210).reduceMotion(ReduceMotion.System);
}

export function categoryExiting(direction: -1 | 1) {
  return (direction > 0 ? FadeOutLeft : FadeOutRight)
    .duration(140)
    .reduceMotion(ReduceMotion.System);
}
