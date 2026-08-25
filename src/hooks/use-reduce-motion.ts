import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * OS의 "동작 줄이기" 설정.
 *
 * 켜져 있으면 애니메이션을 생략하고 최종 상태를 즉시 보여준다.
 * 전정기관이 예민한 사용자에게 움직임은 불편을 넘어 어지럼증을 유발한다.
 */
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
}
