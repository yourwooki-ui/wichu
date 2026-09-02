import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppModal } from '@/components/AppModal';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius, typography } from '@/constants/theme';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';

const STEPS = [
  {
    icon: illustratedIcons.discoverySettings,
    key: 'header',
    target: 'header',
  },
  {
    icon: illustratedIcons.profileEdit,
    key: 'card',
    target: 'card',
  },
  {
    icon: illustratedIcons.connections,
    key: 'tabs',
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
  const { t } = useTranslation();
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
    if (userId) void tutorialState.completeDiscoverCoach(userId).catch(() => undefined);
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
                  <Text style={styles.eyebrow}>
                    {t(`discoveryControls.coach.steps.${step.key}.eyebrow`)}
                  </Text>
                  <Text style={styles.counter}>
                    {stepIndex + 1} / {STEPS.length}
                  </Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" hitSlop={10} onPress={finish}>
                <Text style={styles.skipText}>{t('discoveryControls.coach.skip')}</Text>
              </Pressable>
            </View>
            <Text style={styles.title}>{t(`discoveryControls.coach.steps.${step.key}.title`)}</Text>
            <Text style={styles.body}>{t(`discoveryControls.coach.steps.${step.key}.body`)}</Text>
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
                <Text style={styles.nextText}>
                  {isLastStep
                    ? t('discoveryControls.coach.start')
                    : t('discoveryControls.coach.next')}
                </Text>
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
    ...Platform.select({
      web: { boxShadow: '0 0 10px rgba(255,45,111,0.28)' },
      default: {
        elevation: 4,
        shadowColor: '#FF2D6F',
        shadowOffset: { height: 0, width: 0 },
        shadowOpacity: 0.28,
        shadowRadius: 10,
      },
    }),
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
  eyebrow: { ...typography.overline, color: palette.pink },
  counter: { ...typography.caption, color: palette.inkMuted, fontWeight: '800', marginTop: 2 },
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
