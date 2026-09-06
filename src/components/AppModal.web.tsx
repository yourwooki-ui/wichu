import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, type ModalProps } from 'react-native';

import { PREVIEW_MODAL_HOST_ID } from '@/components/NativePreviewFrame';
import { motionDuration, resolveMotionDuration } from '@/constants/motion';
import { useReduceMotion } from '@/hooks/use-reduce-motion';

type WebAppModalProps = Omit<ModalProps, 'onRequestClose'> & {
  onRequestClose?: () => void;
};

export function AppModal({
  animationType = 'none',
  children,
  onRequestClose,
  visible,
}: WebAppModalProps) {
  const [opacity] = useState(() => new Animated.Value(visible && animationType === 'fade' ? 0 : 1));
  const reduceMotion = useReduceMotion();
  const host =
    typeof document === 'undefined' ? null : document.getElementById(PREVIEW_MODAL_HOST_ID);

  useEffect(() => {
    if (!visible || animationType !== 'fade') {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      duration: resolveMotionDuration(reduceMotion, motionDuration.fast),
      toValue: 1,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animationType, opacity, reduceMotion, visible]);

  useEffect(() => {
    if (!visible || !onRequestClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onRequestClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onRequestClose, visible]);

  if (!visible || !host) return null;

  return createPortal(
    <Animated.View accessibilityViewIsModal style={[styles.layer, { opacity }]}>
      {children}
    </Animated.View>,
    host,
  );
}

const styles = StyleSheet.create({
  layer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
});
