import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { BrandWordmark } from '@/components/BrandWordmark';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { tabIconSources, type TabName } from '@/constants/tab-icons';
import { palette, radius } from '@/constants/theme';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';

const STEPS = [
  {
    title: '상단에서 바로 조절해요',
    body: '왼쪽은 마지막 선택 되돌리기, 오른쪽은 탐색 조건과 알림이에요.',
    target: 'header',
  },
  {
    title: '카드가 발견의 중심이에요',
    body: '좌우로 넘겨 선택하고, 한 번 누르면 상세 프로필을 확인할 수 있어요.',
    target: 'card',
  },
  {
    title: '하단에서 언제든 이동해요',
    body: '매치, 채팅, 발견, 상점, 내 프로필로 바로 이동할 수 있어요.',
    target: 'tabs',
  },
] as const;

type DiscoverGestureCoachProps = {
  active: boolean;
  onComplete: () => void;
  userId?: string;
};

export function DiscoverGestureCoach({ active, onComplete, userId }: DiscoverGestureCoachProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useAppViewport();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const contentWidth = Math.min(width, 620);

  const finish = () => {
    setStepIndex(0);
    if (userId) void tutorialState.completeDiscoverCoach(userId);
    onComplete();
  };

  const next = () => {
    if (isLastStep) {
      finish();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  if (!active) return null;

  return (
    <AppModal animationType="fade" onRequestClose={finish} transparent visible>
      <View accessibilityViewIsModal style={styles.backdrop}>
        <View style={[styles.stage, { height, width: contentWidth }]}>
          {step.target === 'header' ? <HeaderSpotlight top={Math.max(insets.top, 8) + 3} /> : null}
          {step.target === 'card' ? (
            <CardSpotlight
              bottom={Math.max(insets.bottom, 8) + 112}
              top={Math.max(insets.top, 8) + 74}
            />
          ) : null}
          {step.target === 'tabs' ? (
            <TabsSpotlight bottom={Math.max(insets.bottom, 8) + 8} />
          ) : null}

          <View
            style={[
              styles.coachCard,
              step.target === 'header' && { top: Math.max(insets.top, 8) + 86 },
              step.target === 'card' && { bottom: Math.max(insets.bottom, 8) + 128 },
              step.target === 'tabs' && { bottom: Math.max(insets.bottom, 8) + 112 },
            ]}
          >
            <View style={styles.coachTopRow}>
              <Text style={styles.stepText}>
                {stepIndex + 1} / {STEPS.length}
              </Text>
              <Pressable accessibilityRole="button" hitSlop={8} onPress={finish}>
                <Text style={styles.skipText}>건너뛰기</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <View style={styles.actionRow}>
              <View style={styles.dots}>
                {STEPS.map((item, index) => (
                  <View
                    key={item.target}
                    style={[styles.dot, index === stepIndex && styles.dotActive]}
                  />
                ))}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={next}
                style={({ pressed }) => [styles.next, pressed && styles.pressed]}
              >
                <Text style={styles.nextText}>{isLastStep ? '시작하기' : '다음'}</Text>
                <Ionicons color={palette.white} name="arrow-forward" size={16} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </AppModal>
  );
}

function HeaderSpotlight({ top }: { top: number }) {
  return (
    <View style={[styles.headerSpotlight, { top }]}>
      <IllustratedIcon size={50} source={illustratedIcons.rewind} />
      <BrandWordmark color={palette.ink} size={20} />
      <View style={styles.headerRight}>
        <IllustratedIcon size={50} source={illustratedIcons.discoverySettings} />
        <IllustratedIcon size={50} source={illustratedIcons.notification} />
      </View>
    </View>
  );
}

function CardSpotlight({ bottom, top }: { bottom: number; top: number }) {
  return (
    <View style={[styles.cardSpotlight, { bottom, top }]}>
      <View style={styles.cardGestureRow}>
        <GestureMark icon="arrow-back" label="PASS" />
        <GestureMark icon="hand-left-outline" label="상세 보기" />
        <GestureMark icon="arrow-forward" label="PICK" />
      </View>
      <View style={styles.doubleTap}>
        <Ionicons color={palette.pink} name="heart" size={15} />
        <Text style={styles.doubleTapText}>빠르게 두 번 누르면 PICK</Text>
      </View>
    </View>
  );
}

function GestureMark({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.gestureMark}>
      <Ionicons color={palette.ink} name={icon} size={20} />
      <Text style={styles.gestureLabel}>{label}</Text>
    </View>
  );
}

const TAB_LABELS: Record<TabName, string> = {
  matches: '매치',
  chat: '채팅',
  discover: '발견',
  shop: '상점',
  me: '나',
};

function TabsSpotlight({ bottom }: { bottom: number }) {
  return (
    <View style={[styles.tabsSpotlight, { bottom }]}>
      {(Object.keys(tabIconSources) as TabName[]).map((name) => (
        <View key={name} style={styles.tabItem}>
          <Image contentFit="contain" source={tabIconSources[name]} style={styles.tabIcon} />
          <Text style={[styles.tabLabel, name === 'discover' && styles.tabLabelActive]}>
            {TAB_LABELS[name]}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(13,13,17,0.68)',
    flex: 1,
    justifyContent: 'center',
  },
  stage: { maxWidth: 620, position: 'relative' },
  headerSpotlight: {
    alignItems: 'center',
    backgroundColor: '#FAFAFC',
    borderColor: '#FF6B99',
    borderRadius: 20,
    borderWidth: 2,
    flexDirection: 'row',
    height: 66,
    justifyContent: 'space-between',
    left: 10,
    paddingHorizontal: 7,
    position: 'absolute',
    right: 10,
  },
  headerRight: { alignItems: 'center', flexDirection: 'row' },
  cardSpotlight: {
    alignItems: 'center',
    backgroundColor: 'rgba(250,250,252,0.97)',
    borderColor: '#FF6B99',
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center',
    left: 12,
    padding: 18,
    position: 'absolute',
    right: 12,
  },
  cardGestureRow: { flexDirection: 'row', gap: 10, justifyContent: 'center', width: '100%' },
  gestureMark: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E2E2E7',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    gap: 7,
    maxWidth: 108,
    paddingHorizontal: 5,
    paddingVertical: 15,
  },
  gestureLabel: { color: palette.ink, fontSize: 10, fontWeight: '900' },
  doubleTap: {
    alignItems: 'center',
    backgroundColor: '#FFE8EF',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doubleTapText: { color: palette.ink, fontSize: 10, fontWeight: '800' },
  tabsSpotlight: {
    alignItems: 'center',
    backgroundColor: '#FAFAFC',
    borderColor: '#FF6B99',
    borderRadius: 22,
    borderWidth: 2,
    flexDirection: 'row',
    height: 90,
    justifyContent: 'space-around',
    left: 10,
    paddingHorizontal: 5,
    position: 'absolute',
    right: 10,
  },
  tabItem: { alignItems: 'center', flex: 1, gap: 3 },
  tabIcon: { height: 36, width: 36 },
  tabLabel: { color: palette.inkMuted, fontSize: 10, fontWeight: '800' },
  tabLabelActive: { color: palette.pink },
  coachCard: {
    backgroundColor: '#FAFAFC',
    borderRadius: 26,
    left: 18,
    padding: 20,
    position: 'absolute',
    right: 18,
  },
  coachTopRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  stepText: { color: palette.pink, fontSize: 10, fontWeight: '900', letterSpacing: 0.9 },
  skipText: { color: palette.inkMuted, fontSize: 10, fontWeight: '800' },
  title: {
    color: palette.ink,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.65,
    lineHeight: 28,
    marginTop: 13,
  },
  body: { color: palette.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 7 },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { backgroundColor: '#D8D8DD', borderRadius: radius.pill, height: 5, width: 5 },
  dotActive: { backgroundColor: palette.pink, width: 20 },
  next: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 18,
  },
  nextText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
