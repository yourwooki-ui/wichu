import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/AppModal';
import { palette, radius } from '@/constants/theme';

const STORAGE_KEY = '@wichu/discover-gesture-coach-v1';

export function DiscoverGestureCoach() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((seen) => {
      if (!seen) setVisible(true);
    });
  }, []);

  const dismiss = () => {
    setVisible(false);
    void AsyncStorage.setItem(STORAGE_KEY, 'seen');
  };

  return (
    <AppModal animationType="fade" onRequestClose={dismiss} transparent visible={visible}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.card}>
          <View style={styles.mark}>
            <Ionicons color={palette.white} name="sparkles" size={23} />
          </View>
          <Text style={styles.eyebrow}>HOW TO DISCOVER</Text>
          <Text style={styles.title}>가볍게 넘기고,{`\n`}궁금하면 자세히 봐요.</Text>
          <View style={styles.gestures}>
            <GestureItem icon="arrow-back" label="왼쪽" value="PASS" />
            <GestureItem icon="hand-left-outline" label="한 번 탭" value="상세 보기" />
            <GestureItem icon="arrow-forward" label="오른쪽" value="PICK" />
          </View>
          <View style={styles.doubleTapHint}>
            <Ionicons color={palette.pink} name="heart" size={15} />
            <Text style={styles.doubleTapText}>카드를 빠르게 두 번 탭해도 PICK할 수 있어요.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.action}>
            <Text style={styles.actionText}>시작하기</Text>
          </Pressable>
        </View>
      </View>
    </AppModal>
  );
}

function GestureItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.gestureItem}>
      <View style={styles.gestureIcon}>
        <Ionicons color={palette.ink} name={icon} size={20} />
      </View>
      <Text style={styles.gestureValue}>{value}</Text>
      <Text style={styles.gestureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,13,17,0.58)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: '#F8F8FA',
    borderRadius: 30,
    maxWidth: 390,
    padding: 24,
    width: '100%',
  },
  mark: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  eyebrow: {
    color: palette.pink,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginTop: 14,
  },
  title: {
    color: palette.ink,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 29,
    marginTop: 5,
    textAlign: 'center',
  },
  gestures: { flexDirection: 'row', gap: 8, marginTop: 21, width: '100%' },
  gestureItem: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E2E2E7',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minHeight: 110,
    paddingHorizontal: 5,
    paddingVertical: 13,
  },
  gestureIcon: {
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  gestureValue: { color: palette.ink, fontSize: 10, fontWeight: '900', marginTop: 9 },
  gestureLabel: { color: palette.inkMuted, fontSize: 8, fontWeight: '700', marginTop: 2 },
  doubleTapHint: {
    alignItems: 'center',
    backgroundColor: '#FFE8EF',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doubleTapText: { color: palette.ink, flexShrink: 1, fontSize: 9, fontWeight: '800' },
  action: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: 17,
    justifyContent: 'center',
    marginTop: 19,
    minHeight: 52,
    width: '100%',
  },
  actionText: { color: palette.white, fontSize: 13, fontWeight: '900' },
});
