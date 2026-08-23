import { createContext, type PropsWithChildren, useContext } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';

const DEVICE_WIDTH = 430;
const DEVICE_HEIGHT = 932;
const FRAME_INSET = 8;
const CANVAS_GAP = 32;
export const PREVIEW_MODAL_HOST_ID = 'wichu-preview-modal-host';
const PreviewViewportContext = createContext<{ height: number; width: number } | null>(null);

export function useAppViewport() {
  const windowDimensions = useWindowDimensions();
  return useContext(PreviewViewportContext) ?? windowDimensions;
}

export function NativePreviewFrame({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const { height, width } = useWindowDimensions();

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  if (width < DEVICE_WIDTH + CANVAS_GAP) {
    return (
      <View style={styles.webRoot}>
        <PreviewViewportContext.Provider value={{ height, width }}>
          {children}
        </PreviewViewportContext.Provider>
        <View
          nativeID={PREVIEW_MODAL_HOST_ID}
          style={[StyleSheet.absoluteFill, styles.modalHostBase]}
        />
      </View>
    );
  }

  const scale = Math.min(
    1,
    (width - CANVAS_GAP) / DEVICE_WIDTH,
    (height - CANVAS_GAP) / DEVICE_HEIGHT,
  );
  const frameWidth = DEVICE_WIDTH * scale;
  const frameHeight = DEVICE_HEIGHT * scale;

  return (
    <View style={styles.canvas}>
      <View style={{ height: frameHeight, width: frameWidth }}>
        <View
          style={[
            styles.device,
            {
              height: DEVICE_HEIGHT,
              transform: [{ scale }],
              transformOrigin: 'top left',
              width: DEVICE_WIDTH,
            },
          ]}
        >
          <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
            <PreviewViewportContext.Provider
              value={{
                height: DEVICE_HEIGHT - FRAME_INSET * 2,
                width: DEVICE_WIDTH - FRAME_INSET * 2,
              }}
            >
              {children}
            </PreviewViewportContext.Provider>
            <View
              nativeID={PREVIEW_MODAL_HOST_ID}
              style={[StyleSheet.absoluteFill, styles.modalHostBase, styles.modalHost]}
            />
            <View style={styles.homeIndicatorArea}>
              <View style={styles.homeIndicator} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webRoot: { flex: 1 },
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
  modalHostBase: { pointerEvents: 'box-none' },
  modalHost: { zIndex: 1000 },
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
    pointerEvents: 'none',
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
