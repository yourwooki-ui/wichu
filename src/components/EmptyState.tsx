import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { StateView, type StateTone } from '@/components/StateView';

type EmptyStateProps = {
  actionLabel?: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  title: string;
  tone?: StateTone;
};

/**
 * 화면 전체를 차지하는 빈 상태.
 *
 * 시각 규격은 `StateView` 하나로 모으고, 여기서는 세로 중앙 정렬만 담당한다.
 */
export function EmptyState({
  actionLabel,
  description,
  icon,
  onAction,
  title,
  tone,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <StateView
        actionLabel={actionLabel}
        body={description}
        container="plain"
        icon={icon}
        onAction={onAction}
        title={title}
        tone={tone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
