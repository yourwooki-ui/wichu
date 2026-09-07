import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  type NativeSyntheticEvent,
  type ScrollViewProps,
  type TargetedEvent,
} from 'react-native';

type KeyboardAwareScrollViewProps = ScrollViewProps & {
  /** 키보드 위에 입력칸과 안내문이 함께 보이도록 확보할 여백입니다. */
  keyboardFocusOffset?: number;
};

/**
 * 긴 폼에서 포커스된 입력칸을 키보드 위로 자동 이동시키는 공통 스크롤입니다.
 *
 * 네이티브 의존성을 추가하지 않고 React Native ScrollView의 공식 responder API를
 * 사용합니다. 포커스 직후와 키보드 전환이 끝난 뒤 두 번 보정해, 키보드가 이미
 * 열린 상태에서 다음 필드로 이동하는 경우와 처음 열리는 경우를 모두 처리합니다.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      automaticallyAdjustKeyboardInsets = Platform.OS === 'ios',
      keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
      keyboardFocusOffset = 24,
      keyboardShouldPersistTaps = 'handled',
      onFocus,
      ...props
    },
    forwardedRef,
  ) {
    const scrollRef = useRef<ScrollView>(null);
    const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
    const focusedTargetRef = useRef<number | null>(null);

    useImperativeHandle(forwardedRef, () => scrollRef.current as ScrollView, []);

    useEffect(
      () => () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
      },
      [],
    );

    const revealFocusedInput = useCallback(
      (target: number) => {
        if (Platform.OS === 'web') return;

        timersRef.current.forEach(clearTimeout);
        // Android의 resize가 끝나는 시점과 iOS 키보드 애니메이션이 끝나는 시점이
        // 기기마다 달라 한 번만 이동하면 긴 multiline 입력이 다시 가려질 수 있다.
        timersRef.current = [50, 240, 520].map((delay) =>
          setTimeout(() => {
            scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(
              target,
              keyboardFocusOffset,
              true,
            );
          }, delay),
        );
      },
      [keyboardFocusOffset],
    );

    useEffect(() => {
      if (Platform.OS === 'web') return;

      const eventName = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const subscription = Keyboard.addListener(eventName, () => {
        const target = focusedTargetRef.current;
        if (target != null) revealFocusedInput(target);
      });

      return () => subscription.remove();
    }, [revealFocusedInput]);

    const handleFocus = useCallback(
      (event: NativeSyntheticEvent<TargetedEvent>) => {
        onFocus?.(event);
        focusedTargetRef.current = event.nativeEvent.target;
        revealFocusedInput(event.nativeEvent.target);
      },
      [onFocus, revealFocusedInput],
    );

    return (
      <ScrollView
        {...props}
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
        keyboardDismissMode={keyboardDismissMode}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        onFocus={handleFocus}
      />
    );
  },
);
