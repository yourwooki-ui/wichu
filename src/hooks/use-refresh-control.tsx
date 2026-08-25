import { useCallback, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';

import { useAppTheme } from '@/components/ThemeProvider';

/**
 * 목록 화면의 당겨서 새로고침을 한 규격으로 제공한다.
 *
 * 브랜드 핑크 스피너를 쓰고, 여러 query를 함께 새로고침할 때도
 * 전부 끝난 뒤에 인디케이터를 내려 사용자가 완료 시점을 오해하지 않게 한다.
 */
export function useRefreshControl(onRefresh: () => Promise<unknown>) {
  const theme = useAppTheme();
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // 각 화면의 query error state가 재시도 UI를 맡는다. 제스처 Promise는 누출하지 않는다.
    } finally {
      inFlightRef.current = false;
      setRefreshing(false);
    }
  }, [onRefresh]);

  return (
    <RefreshControl
      colors={[theme.colors.primary]}
      onRefresh={handleRefresh}
      progressBackgroundColor={theme.colors.surface}
      refreshing={refreshing}
      tintColor={theme.colors.primary}
    />
  );
}
