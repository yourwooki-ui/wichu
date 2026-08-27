import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OS의 "동작 줄이기" 설정.
 *
 * 켜져 있으면 애니메이션을 생략하고 최종 상태를 즉시 보여준다.
 * 전정기관이 예민한 사용자에게 움직임은 불편을 넘어 어지럼증을 유발한다.
 */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let active = true;
    try {
      void AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (active) setReduceMotion(enabled);
        })
        .catch(() => undefined);
    } catch {
      // 조회에 실패하면 장식 모션을 켜지 않는 쪽으로 유지한다.
    }

    let subscription: { remove: () => void } | undefined;
    try {
      subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
        if (active) setReduceMotion(enabled);
      });
    } catch {
      // 제한된 런타임에서는 접근성 이벤트 구독을 지원하지 않을 수 있다.
    }

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return reduceMotion;
}
