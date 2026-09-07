import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Platform, type ScrollView, type ScrollViewProps } from 'react-native';
import {
  KeyboardAwareScrollView as NativeKeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  /** 키보드와 입력 커서 사이에 확보할 보호 여백입니다. */
  keyboardFocusOffset?: number;
};

/**
 * 긴 폼의 모든 입력칸을 키보드 위에 자동으로 유지하는 공통 스크롤입니다.
 *
 * 포커스 이벤트와 시간차 타이머를 직접 추적하지 않고 네이티브 키보드 프레임과
 * 동기화된 Expo 57 호환 컨트롤러를 사용합니다. 따라서 키보드가 열린 상태에서
 * 다음 입력칸으로 이동하거나 multiline 입력이 커져도 같은 방식으로 보정됩니다.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      automaticallyAdjustKeyboardInsets = false,
      keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
      keyboardFocusOffset = 24,
      keyboardShouldPersistTaps = 'handled',
      ...props
    },
    forwardedRef,
  ) {
    const scrollRef = useRef<KeyboardAwareScrollViewRef>(null);

    useImperativeHandle(forwardedRef, () => scrollRef.current as ScrollView, []);

    return (
      <NativeKeyboardAwareScrollView
        {...props}
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
        bottomOffset={keyboardFocusOffset}
        extraKeyboardSpace={12}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        mode="insets"
      />
    );
  },
);
