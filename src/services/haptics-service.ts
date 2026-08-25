import type { SwipeAction } from '@/types/profile';

// 웹 프리뷰에서는 브라우저 진동 권한이나 기기 지원 여부에 따라 경험이 달라지므로 사용하지 않는다.
// Metro는 Android/iOS에서 haptics-service.native.ts를 우선 선택한다.
export const hapticsService = {
  selection() {},
  swipe(_action: SwipeAction) {},
  success() {},
  error() {},
};
