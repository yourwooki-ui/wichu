import { focusManager, onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, StyleSheet, Text, type AppStateStatus, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { palette, radius } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';

/**
 * React Native에는 브라우저의 window focus 이벤트가 없으므로 앱 활성 상태를
 * TanStack Query에 전달한다. 백그라운드에서 돌아왔을 때 오래된 활성 쿼리만
 * 다시 확인하고, 아직 신선한 데이터에는 추가 요청을 만들지 않는다.
 */
export function QueryLifecycleManager() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onAppStateChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };

    try {
      onAppStateChange(AppState.currentState);
      const subscription = AppState.addEventListener('change', onAppStateChange);
      return () => {
        try {
          subscription.remove();
        } catch {
          // 앱 종료 중 네이티브 구독이 먼저 해제된 경우는 무시한다.
        }
      };
    } catch {
      // AppState를 제공하지 않는 제한 런타임에서도 쿼리는 온라인 상태로 동작한다.
      focusManager.setFocused(true);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let removeListener: (() => void) | undefined;

    const applyNetworkState = (state: { isConnected?: boolean; isInternetReachable?: boolean }) => {
      const isOnline = state.isConnected !== false && state.isInternetReachable !== false;
      onlineManager.setOnline(isOnline);
      if (active) setOffline(!isOnline);
      if (isOnline) void queryClient.resumePausedMutations();
    };

    // Network is loaded after React mounts so a native linking problem can never
    // return us to the historical pre-render Android crash.
    void import('expo-network')
      .then(async (Network) => {
        if (!active) return;
        try {
          applyNetworkState(await Network.getNetworkStateAsync());
          const subscription = Network.addNetworkStateListener(applyNetworkState);
          removeListener = () => subscription.remove();
        } catch {
          onlineManager.setOnline(true);
        }
      })
      .catch(() => onlineManager.setOnline(true));

    return () => {
      active = false;
      try {
        removeListener?.();
      } catch {
        // Native teardown can race with app shutdown.
      }
    };
  }, []);

  if (!offline) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.banner, { top: insets.top + 6 }]}
    >
      <View style={styles.dot} />
      <Text numberOfLines={2} style={styles.text}>
        {t('networkStatus.offline')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(24,24,28,0.94)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    left: 18,
    maxWidth: 420,
    minHeight: 42,
    paddingHorizontal: 14,
    position: 'absolute',
    right: 18,
    zIndex: 1000,
  },
  dot: { backgroundColor: palette.pink, borderRadius: 4, height: 8, width: 8 },
  text: { color: palette.white, flex: 1, fontSize: 12, fontWeight: '800', lineHeight: 16 },
});
