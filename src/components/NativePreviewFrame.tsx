import { type PropsWithChildren } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';

const DEVICE_WIDTH = 430;
const DEVICE_HEIGHT = 932;
const FRAME_INSET = 8;
const CANVAS_GAP = 32;

export function NativePreviewFrame({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const { height, width } = useWindowDimensions();

  if (Platform.OS !== 'web' || width < DEVICE_WIDTH + CANVAS_GAP) {
    return <>{children}</>;
  }

  const frameWidth = Math.min(DEVICE_WIDTH, width - CANVAS_GAP);
  const frameHeight = Math.max(500, Math.min(DEVICE_HEIGHT, height - CANVAS_GAP));

  return (
    <View style={styles.canvas}>
      <View style={[styles.device, { height: frameHeight, width: frameWidth }]}>
        <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
          {children}
          <View pointerEvents="none" style={styles.homeIndicatorArea}>
            <View style={styles.homeIndicator} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    alignItems: 'center',
    backgroundColor: '#DADBE0',
    flex: 1,
    justifyContent: 'center',
  },
  device: {
    backgroundColor: '#17171A',
    borderRadius: 48,
    boxShadow: '0 24px 70px rgba(20,20,25,0.24)',
    padding: FRAME_INSET,
  },
  screen: {
    borderRadius: 40,
    flex: 1,
    overflow: 'hidden',
  },
  homeIndicatorArea: {
    alignItems: 'center',
    bottom: 0,
    height: 18,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    zIndex: 100,
  },
  homeIndicator: {
    backgroundColor: '#17171A',
    borderRadius: 999,
    height: 4,
    width: 116,
  },
});
