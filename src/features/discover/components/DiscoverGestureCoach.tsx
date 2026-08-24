import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';

const STEPS = [
  {
    eyebrow: '빠른 기능',
    title: '상단에서 바로 조절해요',
    body: '왼쪽은 마지막 선택 되돌리기, 오른쪽은 탐색 조건과 알림이에요.',
    icon: illustratedIcons.discoverySettings,
    target: 'header',
  },
  {
    eyebrow: '프로필 카드',
    title: '보고, 누르고, 넘겨보세요',
    body: '카드를 누르면 상세 프로필, 왼쪽은 PASS, 오른쪽이나 빠른 두 번 누르기는 PICK이에요.',
    icon: illustratedIcons.profileEdit,
    target: 'card',
  },
  {
    eyebrow: '하단 메뉴',
    title: '필요한 화면으로 바로 이동해요',
    body: '매치, 채팅, 발견, 상점, 내 프로필은 항상 같은 위치에 있어요.',
    icon: illustratedIcons.connections,
    target: 'tabs',
  },
] as const;

type DiscoverGestureCoachProps = {
  active: boolean;
  onComplete: () => void;
  userId?: string;
};

type TargetRect = { height: number; width: number; x: number; y: number };

export function DiscoverGestureCoach({ active, onComplete, userId }: DiscoverGestureCoachProps) {
  const insets = useSafeAreaInsets();
  const viewport = useAppViewport();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const width = Math.min(viewport.width, 620);
  const height = viewport.height;
  const target = getTargetRect(step.target, width, height, insets.top, insets.bottom);

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

  const calloutPosition =
    step.target === 'tabs'
      ? { bottom: height - target.y + 14 }
      : { top: target.y + target.height + 14 };

  return (
    <AppModal animationType="fade" onRequestClose={finish} transparent visible>
      <View accessibilityViewIsModal style={styles.modalRoot}>
        <View style={[styles.stage, { height, width }]}>
          <SpotlightMask height={height} target={target} width={width} />
          <View
            pointerEvents="none"
            style={[
              styles.focusRing,
              {
                height: target.height,
                left: target.x,
                top: target.y,
                width: target.width,
              },
            ]}
          />

          <View style={[styles.callout, calloutPosition]}>
            <View style={styles.calloutHeader}>
              <View style={styles.calloutIdentity}>
                <IllustratedIcon size={38} source={step.icon} />
                <View>
                  <Text style={styles.eyebrow}>{step.eyebrow}</Text>
                  <Text style={styles.counter}>
                    {stepIndex + 1} / {STEPS.length}
                  </Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={finish}>
                <Text style={styles.skipText}>건너뛰기</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <View style={styles.footer}>
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

function SpotlightMask({
  height,
  target,
  width,
}: {
  height: number;
  target: TargetRect;
  width: number;
}) {
  const targetBottom = target.y + target.height;
  const targetRight = target.x + target.width;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.dim, { height: target.y, left: 0, top: 0, width }]} />
      <View
        style={[styles.dim, { height: target.height, left: 0, top: target.y, width: target.x }]}
      />
      <View
        style={[
          styles.dim,
          { height: target.height, left: targetRight, top: target.y, width: width - targetRight },
        ]}
      />
      <View
        style={[styles.dim, { height: height - targetBottom, left: 0, top: targetBottom, width }]}
      />
    </View>
  );
}

function getTargetRect(
  target: (typeof STEPS)[number]['target'],
  width: number,
  height: number,
  insetTop: number,
  insetBottom: number,
): TargetRect {
  if (target === 'header') {
    return { height: 68, width: width - 16, x: 8, y: Math.max(insetTop, 8) + 1 };
  }

  if (target === 'tabs') {
    const bottom = Math.max(insetBottom, 8) + 7;
    return { height: 92, width: width - 16, x: 8, y: height - bottom - 92 };
  }

  const y = Math.max(insetTop, 8) + 76;
  return {
    height: Math.max(250, Math.min(470, height - y - 330)),
    width: width - 20,
    x: 10,
    y,
  };
}

const styles = StyleSheet.create({
  modalRoot: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  stage: { maxWidth: 620, position: 'relative' },
  dim: { backgroundColor: 'rgba(13,13,17,0.72)', position: 'absolute' },
  focusRing: {
    borderColor: '#FF4A82',
    borderRadius: 25,
    borderWidth: 2,
    position: 'absolute',
    shadowColor: '#FF2D6F',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  callout: {
    backgroundColor: '#FAFAFC',
    borderRadius: 25,
    left: 15,
    padding: 19,
    position: 'absolute',
    right: 15,
  },
  calloutHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  calloutIdentity: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  eyebrow: { color: palette.pink, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  counter: { color: palette.inkMuted, fontSize: 9, fontWeight: '800', marginTop: 2 },
  skipText: { color: palette.inkMuted, fontSize: 10, fontWeight: '800' },
  title: {
    color: palette.ink,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.65,
    lineHeight: 27,
    marginTop: 13,
  },
  body: { color: palette.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 6 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
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
