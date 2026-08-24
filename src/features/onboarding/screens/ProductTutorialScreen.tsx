import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';
import { useAuthSession } from '@/hooks/use-auth-session';

const STEPS = [
  {
    accent: '#FF2D6F',
    background: ['#FFE7EF', '#FFF8FA'] as const,
    eyebrow: 'DISCOVER',
    illustration: illustratedIcons.discoverySettings,
    title: '한 명씩 보고\n내 선택을 남겨요',
    body: '왼쪽으로 넘기면 PASS, 오른쪽으로 넘기거나 빠르게 두 번 누르면 PICK이에요.',
    notes: ['카드를 한 번 누르면 상세 프로필', '탐색 조건은 상단 버튼에서 변경'],
  },
  {
    accent: '#111113',
    background: ['#F0F0F3', '#FCFCFD'] as const,
    eyebrow: 'MATCH',
    illustration: illustratedIcons.connections,
    title: '서로 PICK하면\n매치가 시작돼요',
    body: '상대도 나를 선택하면 매치돼요. 매치된 사용자와만 1:1 대화를 시작할 수 있어요.',
    notes: ['나를 픽한 사람·매치·방문자 확인', '원하지 않는 사용자는 차단 또는 신고'],
  },
  {
    accent: '#176E4D',
    background: ['#E5F7EF', '#F7FCF9'] as const,
    eyebrow: 'CHAT & TRANSLATE',
    illustration: illustratedIcons.translation,
    title: '언어가 달라도\n바로 대화해요',
    body: '원문을 유지하면서 번역을 확인할 수 있어요. 메시지는 전송하는 즉시 대화에 표시돼요.',
    notes: ['번역 결과와 원문을 함께 확인', '알림과 공개 범위는 설정에서 변경'],
  },
] as const;

export function ProductTutorialScreen() {
  const router = useRouter();
  const { session } = useAuthSession();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const finish = async () => {
    if (finishing) return;
    setFinishing(true);
    if (session?.user.id) {
      await tutorialState.completeProductTutorial(session.user.id).catch(() => undefined);
    }
    router.replace('/(tabs)/discover?coach=1');
  };

  const next = () => {
    if (isLastStep) {
      void finish();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <BrandWordmark color={palette.ink} size={22} />
          <Pressable
            accessibilityLabel="튜토리얼 건너뛰기"
            accessibilityRole="button"
            disabled={finishing}
            hitSlop={8}
            onPress={() => void finish()}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          >
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        </View>

        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {String(stepIndex + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: step.accent,
                  width: `${((stepIndex + 1) / STEPS.length) * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        <LinearGradient colors={step.background} style={styles.visual}>
          <View style={styles.visualOrb}>
            <IllustratedIcon size={116} source={step.illustration} />
          </View>
          <View style={[styles.visualPill, { borderColor: `${step.accent}33` }]}>
            <Text style={[styles.visualPillText, { color: step.accent }]}>{step.eyebrow}</Text>
          </View>
        </LinearGradient>

        <View style={styles.copy}>
          <Text style={[styles.eyebrow, { color: step.accent }]}>{step.eyebrow}</Text>
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.notes}>
            {step.notes.map((note) => (
              <View key={note} style={styles.noteRow}>
                <View style={[styles.check, { backgroundColor: `${step.accent}14` }]}>
                  <Ionicons color={step.accent} name="checkmark" size={14} />
                </View>
                <Text style={styles.noteText}>{note}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((item, index) => (
              <View
                key={item.eyebrow}
                style={[
                  styles.dot,
                  index === stepIndex && [styles.dotActive, { backgroundColor: step.accent }],
                ]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={finishing}
            onPress={next}
            style={({ pressed }) => [
              styles.primary,
              { backgroundColor: isLastStep ? palette.pink : palette.ink },
              (pressed || finishing) && styles.pressed,
            ]}
          >
            <Text style={styles.primaryText}>
              {finishing ? '준비 중…' : isLastStep ? '발견 시작하기' : '다음'}
            </Text>
            {!finishing ? <Ionicons color={palette.white} name="arrow-forward" size={18} /> : null}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F7F7F9', flex: 1 },
  screen: { alignSelf: 'center', flex: 1, maxWidth: 620, paddingHorizontal: 20, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 62,
    justifyContent: 'space-between',
  },
  skip: { alignItems: 'center', justifyContent: 'center', minHeight: 44, paddingLeft: 18 },
  skipText: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  progressRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 14 },
  progressText: { color: palette.ink, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  progressTrack: {
    backgroundColor: '#E4E4E8',
    borderRadius: radius.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: { borderRadius: radius.pill, height: '100%' },
  visual: {
    alignItems: 'center',
    borderColor: 'rgba(17,17,19,0.04)',
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    height: '35%',
    justifyContent: 'center',
    maxHeight: 310,
    minHeight: 220,
    overflow: 'hidden',
  },
  visualOrb: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderRadius: 72,
    height: 144,
    justifyContent: 'center',
    width: 144,
  },
  visualPill: {
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    bottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    position: 'absolute',
  },
  visualPillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  copy: { paddingHorizontal: 2, paddingTop: 21 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 34,
    marginTop: 7,
  },
  body: { color: palette.inkMuted, fontSize: 12, lineHeight: 19, marginTop: 10 },
  notes: { gap: 8, marginTop: 15 },
  noteRow: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  check: {
    alignItems: 'center',
    borderRadius: 10,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  noteText: { color: palette.ink, flex: 1, fontSize: 11, fontWeight: '800' },
  footer: { marginTop: 'auto', paddingBottom: 12, paddingTop: 16 },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 14 },
  dot: { backgroundColor: '#D7D7DC', borderRadius: radius.pill, height: 5, width: 5 },
  dotActive: { width: 24 },
  primary: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  primaryText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
