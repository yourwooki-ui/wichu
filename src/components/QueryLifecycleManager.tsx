import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

/**
 * React Native에는 브라우저의 window focus 이벤트가 없으므로 앱 활성 상태를
 * TanStack Query에 전달한다. 백그라운드에서 돌아왔을 때 오래된 활성 쿼리만
 * 다시 확인하고, 아직 신선한 데이터에는 추가 요청을 만들지 않는다.
 */
export function QueryLifecycleManager() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const onAppStateChange = (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    };

    onAppStateChange(AppState.currentState);
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  return null;
}
