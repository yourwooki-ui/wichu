import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { StyleSheet, View, type ModalProps } from 'react-native';

import { PREVIEW_MODAL_HOST_ID } from '@/components/NativePreviewFrame';

type WebAppModalProps = Omit<ModalProps, 'onRequestClose'> & {
  onRequestClose?: () => void;
};

export function AppModal({ children, onRequestClose, visible }: WebAppModalProps) {
  const host =
    typeof document === 'undefined' ? null : document.getElementById(PREVIEW_MODAL_HOST_ID);

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
    <View accessibilityViewIsModal style={styles.layer}>
      {children}
    </View>,
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
