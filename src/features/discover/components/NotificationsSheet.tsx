import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/constants/theme';

export function NotificationsSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>알림</Text>
            <Pressable accessibilityLabel="알림 닫기" onPress={onClose} style={styles.close}>
              <Ionicons color={palette.ink} name="close" size={21} />
            </Pressable>
          </View>
          <View style={styles.empty}>
            <View style={styles.icon}>
              <Ionicons color="#E9AD17" name="notifications-outline" size={27} />
            </View>
            <Text style={styles.emptyTitle}>새로운 알림이 없어요</Text>
            <Text style={styles.emptyText}>
              새로운 Pick, Match와 메시지가 생기면 여기에 알려드릴게요.
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(17,17,17,0.38)', flex: 1, justifyContent: 'flex-end' },
  sheet: {
    alignSelf: 'center',
    backgroundColor: '#F8F8FA',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    maxWidth: 460,
    minHeight: 330,
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: palette.line,
    borderRadius: 2,
    height: 4,
    marginBottom: 14,
    marginTop: 10,
    width: 38,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  title: { color: palette.ink, fontSize: 22, fontWeight: '900' },
  close: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  empty: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  icon: {
    alignItems: 'center',
    backgroundColor: '#FFF4CF',
    borderRadius: 29,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  emptyTitle: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 15 },
  emptyText: {
    color: palette.inkMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 6,
    maxWidth: 250,
    textAlign: 'center',
  },
});
