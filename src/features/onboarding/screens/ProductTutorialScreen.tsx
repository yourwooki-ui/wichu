import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { CountryFlag } from '@/components/CountryFlag';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';
import { useAuthSession } from '@/hooks/use-auth-session';

const TUTORIAL_PHOTOS = {
  lina: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',
  mia: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',
} as const;

const STEPS = [
  {
    accent: '#FF2D6F',
    eyebrow: 'DISCOVER',
    illustration: illustratedIcons.discoverySettings,
    title: '한 명씩 보고\n내 선택을 남겨요',
    body: '프로필을 충분히 확인한 다음 자연스럽게 넘겨보세요.',
    notes: ['왼쪽 PASS · 오른쪽 PICK', '한 번 누르면 상세 프로필'],
    tip: '다음 프로필은 미리 준비되어 선택 후 바로 이어져요.',
    tipIcon: illustratedIcons.discoveryVisible,
    visual: 'discover',
  },
  {
    accent: '#111113',
    eyebrow: 'MATCH',
    illustration: illustratedIcons.connections,
    title: '서로 PICK하면\n대화가 열려요',
    body: '상대도 나를 선택했을 때만 매치되고 1:1 채팅을 시작할 수 있어요.',
    notes: ['매치된 사용자만 메시지 가능', '언제든 차단·신고 가능'],
    tip: '매치 전에는 상대에게 메시지를 보낼 수 없어요.',
    tipIcon: illustratedIcons.safety,
    visual: 'match',
  },
  {
    accent: '#176E4D',
    eyebrow: 'CHAT & TRANSLATE',
    illustration: illustratedIcons.translation,
    title: '언어가 달라도\n바로 대화해요',
    body: '원문은 그대로 두고 필요한 메시지만 자연스럽게 번역해요.',
    notes: ['원문과 번역을 함께 확인', '메시지는 즉시 화면에 표시'],
    tip: '번역은 원문을 바꾸지 않고 별도로 표시돼요.',
    tipIcon: illustratedIcons.translation,
    visual: 'chat',
  },
] as const;

export function ProductTutorialScreen() {
  const router = useRouter();
  const { session } = useAuthSession();
  const { height } = useAppViewport();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const compact = height < 720;

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
          <View style={styles.logoSlot}>
            <BrandWordmark color={palette.ink} size={22} />
          </View>
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

        <View accessibilityLabel={`${stepIndex + 1}/${STEPS.length} 단계`} style={styles.segments}>
          {STEPS.map((item, index) => (
            <View key={item.eyebrow} style={styles.segmentTrack}>
              {index <= stepIndex ? (
                <View
                  style={[
                    styles.segmentFill,
                    { backgroundColor: index === stepIndex ? step.accent : palette.ink },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>

        <View style={styles.content}>
          <TutorialVisual compact={compact} kind={step.visual} />

          <View style={[styles.copy, compact && styles.copyCompact]}>
            <View style={styles.eyebrowRow}>
              <IllustratedIcon size={28} source={step.illustration} />
              <Text style={[styles.eyebrow, { color: step.accent }]}>{step.eyebrow}</Text>
            </View>
            <Text style={[styles.title, compact && styles.titleCompact]}>{step.title}</Text>
            <Text style={styles.body}>{step.body}</Text>
            <View style={styles.noteGrid}>
              {step.notes.map((note) => (
                <View key={note} style={styles.noteChip}>
                  <Ionicons color={step.accent} name="checkmark-circle" size={16} />
                  <Text numberOfLines={1} style={styles.noteText}>
                    {note}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.tipCard}>
              <IllustratedIcon size={34} source={step.tipIcon} />
              <View style={styles.tipCopy}>
                <Text style={styles.tipLabel}>알아두세요</Text>
                <Text style={styles.tipText}>{step.tip}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.footer}>
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

function TutorialVisual({
  compact,
  kind,
}: {
  compact: boolean;
  kind: (typeof STEPS)[number]['visual'];
}) {
  const { height: viewportHeight } = useAppViewport();
  const height = compact ? 250 : Math.min(410, viewportHeight * 0.44);

  if (kind === 'match') return <MatchVisual height={height} />;
  if (kind === 'chat') return <ChatVisual height={height} />;
  return <DiscoverVisual height={height} />;
}

function DiscoverVisual({ height }: { height: number }) {
  return (
    <View style={[styles.visual, styles.discoverVisual, { height }]}>
      <Image
        contentFit="cover"
        source={{ uri: TUTORIAL_PHOTOS.lina }}
        style={StyleSheet.absoluteFill}
        transition={180}
      />
      <LinearGradient
        colors={['rgba(12,12,14,0.02)', 'rgba(12,12,14,0.12)', 'rgba(12,12,14,0.88)']}
        locations={[0, 0.54, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.discoverTopRow}>
        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>ONLINE</Text>
        </View>
        <View style={styles.distancePill}>
          <IllustratedIcon size={20} source={illustratedIcons.location} />
          <Text style={styles.distanceText}>18 km</Text>
        </View>
      </View>
      <View style={styles.swipeMarks}>
        <View style={[styles.swipeMark, styles.passMark]}>
          <Ionicons color={palette.ink} name="arrow-back" size={17} />
          <Text style={styles.passMarkText}>PASS</Text>
        </View>
        <View style={[styles.swipeMark, styles.pickMark]}>
          <Text style={styles.pickMarkText}>PICK</Text>
          <Ionicons color={palette.white} name="arrow-forward" size={17} />
        </View>
      </View>
      <View style={styles.discoverCopy}>
        <View style={styles.discoverNameRow}>
          <Text style={styles.discoverName}>Lina, 24</Text>
          <CountryFlag compact countryCode="DE" style={styles.discoverFlag} />
        </View>
        <Text style={styles.discoverMeta}>디자인 전공 · 사진 심사 완료</Text>
        <View style={styles.tagRow}>
          {['디자인', '여행', '인디 음악'].map((tag) => (
            <View key={tag} style={styles.profileTag}>
              <Text style={styles.profileTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function MatchVisual({ height }: { height: number }) {
  return (
    <LinearGradient colors={['#FFF0C4', '#FFE6EF', '#FFF9FB']} style={[styles.visual, { height }]}>
      <Text style={styles.matchOverline}>TWO PEOPLE · ONE PICK</Text>
      <View style={styles.matchPortraits}>
        <View style={[styles.matchPortrait, styles.matchPortraitLeft]}>
          <Image
            contentFit="cover"
            source={{ uri: TUTORIAL_PHOTOS.lina }}
            style={styles.matchImage}
            transition={180}
          />
        </View>
        <View style={[styles.matchPortrait, styles.matchPortraitRight]}>
          <Image
            contentFit="cover"
            source={{ uri: TUTORIAL_PHOTOS.mia }}
            style={styles.matchImage}
            transition={180}
          />
        </View>
        <View style={styles.matchCenter}>
          <IllustratedIcon size={58} source={illustratedIcons.connections} />
        </View>
      </View>
      <View style={styles.matchResult}>
        <View style={styles.matchStatusDot} />
        <Text style={styles.matchResultText}>서로 PICK했어요</Text>
      </View>
      <Text style={styles.matchNames}>Lina × Mia</Text>
    </LinearGradient>
  );
}

function ChatVisual({ height }: { height: number }) {
  return (
    <LinearGradient colors={['#EDF7F3', '#F4F2FF', '#FFFFFF']} style={[styles.visual, { height }]}>
      <View style={styles.chatHeader}>
        <Image
          contentFit="cover"
          source={{ uri: TUTORIAL_PHOTOS.mia }}
          style={styles.chatAvatar}
          transition={180}
        />
        <View style={styles.chatHeaderCopy}>
          <Text style={styles.chatName}>Mia</Text>
          <Text style={styles.chatPresence}>온라인</Text>
        </View>
        <IllustratedIcon size={36} source={illustratedIcons.translation} />
      </View>
      <View style={styles.chatThread}>
        <View style={styles.theirBubble}>
          <Text style={styles.theirMessage}>What kind of music do you like?</Text>
          <View style={styles.translationRow}>
            <IllustratedIcon size={22} source={illustratedIcons.translation} />
            <Text style={styles.translationText}>어떤 음악을 좋아해?</Text>
          </View>
        </View>
        <View style={styles.mineBubble}>
          <Text style={styles.mineMessage}>요즘은 R&B를 많이 들어요 :)</Text>
          <Text style={styles.sentText}>전송됨</Text>
        </View>
      </View>
      <View style={styles.chatComposer}>
        <Text style={styles.composerPlaceholder}>메시지 보내기</Text>
        <View style={styles.sendButton}>
          <Ionicons color={palette.white} name="arrow-up" size={16} />
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F7F7F9', flex: 1 },
  screen: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: 620,
    paddingHorizontal: 18,
    paddingTop: 10,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 52,
    justifyContent: 'space-between',
  },
  logoSlot: { height: 44, justifyContent: 'center' },
  skip: { alignItems: 'center', height: 44, justifyContent: 'center' },
  skipText: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  segments: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  segmentTrack: {
    backgroundColor: '#DEDEE3',
    borderRadius: radius.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  segmentFill: { borderRadius: radius.pill, height: '100%', width: '100%' },
  content: { flex: 1 },
  visual: {
    borderColor: 'rgba(17,17,19,0.06)',
    borderRadius: 30,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
  },
  discoverVisual: { backgroundColor: '#D9D9DE' },
  discoverTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 14,
    position: 'absolute',
    right: 14,
    top: 14,
  },
  livePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(17,17,19,0.72)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveDot: { backgroundColor: '#7DFF8A', borderRadius: 4, height: 7, width: 7 },
  liveText: { color: palette.white, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  distancePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distanceText: { color: palette.ink, fontSize: 9, fontWeight: '900' },
  swipeMarks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 12,
    position: 'absolute',
    right: 12,
    top: '46%',
  },
  swipeMark: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  passMark: { backgroundColor: 'rgba(255,255,255,0.92)' },
  passMarkText: { color: palette.ink, fontSize: 9, fontWeight: '900' },
  pickMark: { backgroundColor: palette.pink },
  pickMarkText: { color: palette.white, fontSize: 9, fontWeight: '900' },
  discoverCopy: { bottom: 16, left: 16, position: 'absolute', right: 16 },
  discoverNameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  discoverFlag: { borderRadius: 5, height: 20, width: 28 },
  discoverName: { color: palette.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },
  discoverMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 10, marginTop: 3 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  profileTag: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  profileTagText: { color: palette.white, fontSize: 9, fontWeight: '800' },
  matchOverline: {
    color: '#6C5400',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 20,
    textAlign: 'center',
  },
  matchPortraits: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 5,
  },
  matchPortrait: {
    backgroundColor: palette.white,
    borderColor: palette.white,
    borderRadius: 34,
    borderWidth: 4,
    height: '78%',
    maxHeight: 190,
    overflow: 'hidden',
    width: '34%',
  },
  matchPortraitLeft: { transform: [{ rotate: '-5deg' }, { translateX: 6 }] },
  matchPortraitRight: { transform: [{ rotate: '5deg' }, { translateX: -6 }] },
  matchImage: { height: '100%', width: '100%' },
  matchCenter: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 36,
    height: 66,
    justifyContent: 'center',
    position: 'absolute',
    width: 66,
    zIndex: 2,
  },
  matchResult: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  matchStatusDot: { backgroundColor: '#C9FF2E', borderRadius: 4, height: 7, width: 7 },
  matchResultText: { color: palette.white, fontSize: 10, fontWeight: '900' },
  matchNames: {
    color: palette.ink,
    fontSize: 10,
    fontWeight: '900',
    marginBottom: 16,
    marginTop: 7,
    textAlign: 'center',
  },
  chatHeader: {
    alignItems: 'center',
    borderBottomColor: 'rgba(17,17,19,0.06)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginHorizontal: 15,
    paddingVertical: 13,
  },
  chatAvatar: { borderRadius: 18, height: 36, width: 36 },
  chatHeaderCopy: { flex: 1, marginLeft: 9 },
  chatName: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  chatPresence: { color: '#16845D', fontSize: 9, fontWeight: '800', marginTop: 2 },
  chatThread: { flex: 1, gap: 10, justifyContent: 'center', paddingHorizontal: 16 },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: palette.white,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    maxWidth: '82%',
    padding: 12,
  },
  theirMessage: { color: palette.ink, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  translationRow: {
    alignItems: 'center',
    borderTopColor: '#ECECEF',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
    paddingTop: 7,
  },
  translationText: { color: '#176E4D', fontSize: 10, fontWeight: '800' },
  mineBubble: {
    alignSelf: 'flex-end',
    backgroundColor: palette.ink,
    borderRadius: 18,
    borderTopRightRadius: 6,
    maxWidth: '78%',
    padding: 12,
  },
  mineMessage: { color: palette.white, fontSize: 11, fontWeight: '700', lineHeight: 16 },
  sentText: { color: 'rgba(255,255,255,0.55)', fontSize: 8, marginTop: 5, textAlign: 'right' },
  chatComposer: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E5E5E9',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginBottom: 14,
    marginHorizontal: 14,
    minHeight: 44,
    paddingLeft: 14,
    paddingRight: 5,
  },
  composerPlaceholder: { color: palette.inkMuted, flex: 1, fontSize: 10 },
  sendButton: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  copy: { paddingTop: 18 },
  copyCompact: { paddingTop: 13 },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.3 },
  title: {
    color: palette.ink,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.95,
    lineHeight: 33,
    marginTop: 6,
  },
  titleCompact: { fontSize: 23, lineHeight: 28 },
  body: { color: palette.inkMuted, fontSize: 11, lineHeight: 18, marginTop: 8 },
  noteGrid: { flexDirection: 'row', gap: 7, marginTop: 13 },
  noteChip: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: '#E4E4E8',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 8,
  },
  noteText: { color: palette.ink, flex: 1, fontSize: 9, fontWeight: '800' },
  tipCard: {
    alignItems: 'center',
    backgroundColor: '#EEEEF2',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    marginTop: 9,
    minHeight: 52,
    paddingHorizontal: 10,
  },
  tipCopy: { flex: 1 },
  tipLabel: { color: palette.ink, fontSize: 9, fontWeight: '900' },
  tipText: { color: palette.inkMuted, fontSize: 9, lineHeight: 14, marginTop: 2 },
  footer: {
    paddingBottom: 10,
    paddingTop: 12,
  },
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
