import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { CountryFlag } from '@/components/CountryFlag';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { useAppViewport } from '@/components/NativePreviewFrame';
import { illustratedIcons } from '@/constants/illustrated-icons';
import {
  layout,
  palette,
  pressFeedback,
  radius,
  spacing,
  touchSlop,
  typography,
} from '@/constants/theme';
import { tutorialState } from '@/features/onboarding/services/tutorial-state';
import { useAuthSession } from '@/hooks/use-auth-session';
import { hapticsService } from '@/services/haptics-service';

const TUTORIAL_PHOTOS = {
  lina: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=85',
  mia: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=900&q=85',
} as const;

const STEPS = [
  {
    accent: '#FF2D6F',
    eyebrow: 'DISCOVER',
    illustration: illustratedIcons.discoverySettings,
    key: 'discover',
    tipIcon: illustratedIcons.discoveryVisible,
    visual: 'discover',
  },
  {
    accent: '#111113',
    eyebrow: 'MATCH',
    illustration: illustratedIcons.connections,
    key: 'match',
    tipIcon: illustratedIcons.safety,
    visual: 'match',
  },
  {
    accent: '#176E4D',
    eyebrow: 'CHAT & TRANSLATE',
    illustration: illustratedIcons.translation,
    key: 'chat',
    tipIcon: illustratedIcons.translation,
    visual: 'chat',
  },
] as const;

export function ProductTutorialScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useAuthSession();
  const { height } = useAppViewport();
  const [stepIndex, setStepIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const reduceMotion = useReducedMotion();
  const transitionProgress = useSharedValue(1);
  const transitionDirection = useSharedValue(1);
  const mounted = useRef(false);
  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const compact = height < 720;

  const contentMotionStyle = useAnimatedStyle(() => ({
    opacity: interpolate(transitionProgress.get(), [0, 1], [0.35, 1]),
    transform: [
      {
        translateX: interpolate(
          transitionProgress.get(),
          [0, 1],
          [transitionDirection.get() * 18, 0],
        ),
      },
    ],
  }));

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    transitionProgress.set(0);
    transitionProgress.set(
      withTiming(1, {
        duration: reduceMotion ? 0 : 220,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [reduceMotion, stepIndex, transitionProgress]);

  const finish = async (feedback: 'complete' | 'skip' = 'complete') => {
    if (finishing) return;
    setFinishing(true);
    if (feedback === 'complete') hapticsService.success();
    else hapticsService.selection();
    if (session?.user.id) {
      await tutorialState.completeProductTutorial(session.user.id).catch(() => undefined);
    }
    router.replace('/(tabs)/discover?coach=1');
  };

  const back = () => {
    transitionDirection.set(-1);
    hapticsService.selection();
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  const next = () => {
    if (isLastStep) {
      void finish('complete');
      return;
    }
    transitionDirection.set(1);
    hapticsService.selection();
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
            accessibilityLabel={t('tutorial.skipA11y')}
            accessibilityRole="button"
            disabled={finishing}
            hitSlop={touchSlop.link}
            onPress={() => void finish('skip')}
            style={({ pressed }) => [styles.skip, pressed && pressFeedback.icon]}
          >
            <Text style={styles.skipText}>{t('tutorial.skip')}</Text>
          </Pressable>
        </View>

        <View
          accessibilityLabel={t('tutorial.progress', {
            current: stepIndex + 1,
            total: STEPS.length,
          })}
          accessibilityRole="progressbar"
          accessibilityValue={{ max: STEPS.length, min: 1, now: stepIndex + 1 }}
          style={styles.segments}
        >
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

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          style={[styles.contentScroll, contentMotionStyle]}
        >
          <TutorialVisual compact={compact} kind={step.visual} />

          <View style={[styles.copy, compact && styles.copyCompact]}>
            <View style={styles.eyebrowRow}>
              <IllustratedIcon size={28} source={step.illustration} />
              <Text style={[styles.eyebrow, { color: step.accent }]}>{step.eyebrow}</Text>
            </View>
            <Text style={[styles.title, compact && styles.titleCompact]}>
              {t(`tutorial.steps.${step.key}.title`)}
            </Text>
            <Text style={styles.body}>{t(`tutorial.steps.${step.key}.body`)}</Text>
            <View style={styles.noteGrid}>
              {[1, 2].map((noteIndex) => {
                const note = t(`tutorial.steps.${step.key}.note${noteIndex}`);
                return (
                  <View key={note} style={styles.noteChip}>
                    <Ionicons color={step.accent} name="checkmark-circle" size={16} />
                    <Text numberOfLines={2} style={styles.noteText}>
                      {note}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.tipCard}>
              <IllustratedIcon size={34} source={step.tipIcon} />
              <View style={styles.tipCopy}>
                <Text style={styles.tipLabel}>{t('tutorial.tip')}</Text>
                <Text style={styles.tipText}>{t(`tutorial.steps.${step.key}.tip`)}</Text>
              </View>
            </View>
          </View>
        </Animated.ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerActions}>
            {stepIndex > 0 ? (
              <Pressable
                accessibilityLabel={t('tutorial.previous')}
                accessibilityRole="button"
                disabled={finishing}
                onPress={back}
                style={({ pressed }) => [styles.backButton, pressed && pressFeedback.control]}
              >
                <Ionicons color={palette.ink} name="arrow-back" size={18} />
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={finishing}
              onPress={next}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: isLastStep ? palette.pink : palette.ink },
                pressed && !finishing && pressFeedback.control,
                finishing && styles.busy,
              ]}
            >
              <Text style={styles.primaryText}>
                {finishing
                  ? t('tutorial.preparing')
                  : isLastStep
                    ? t('tutorial.start')
                    : t('tutorial.next')}
              </Text>
              {!finishing ? (
                <Ionicons color={palette.white} name="arrow-forward" size={18} />
              ) : null}
            </Pressable>
          </View>
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
  kind: 'discover' | 'match' | 'chat';
}) {
  const { height: viewportHeight } = useAppViewport();
  const height = compact ? 250 : Math.min(410, viewportHeight * 0.44);

  if (kind === 'match') return <MatchVisual height={height} />;
  if (kind === 'chat') return <ChatVisual height={height} />;
  return <DiscoverVisual height={height} />;
}

function DiscoverVisual({ height }: { height: number }) {
  const { t } = useTranslation();

  return (
    <View style={[styles.visual, styles.discoverVisual, { height }]}>
      <Image
        cachePolicy="memory-disk"
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
        <Text style={styles.discoverMeta}>{t('tutorial.preview.profileMeta')}</Text>
        <View style={styles.tagRow}>
          {(t('tutorial.preview.tags', { returnObjects: true }) as string[]).map((tag) => (
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
  const { t } = useTranslation();

  return (
    <LinearGradient colors={['#FFF0C4', '#FFE6EF', '#FFF9FB']} style={[styles.visual, { height }]}>
      <Text style={styles.matchOverline}>TWO PEOPLE · ONE PICK</Text>
      <View style={styles.matchPortraits}>
        <View style={[styles.matchPortrait, styles.matchPortraitLeft]}>
          <Image
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: TUTORIAL_PHOTOS.lina }}
            style={styles.matchImage}
            transition={180}
          />
        </View>
        <View style={[styles.matchPortrait, styles.matchPortraitRight]}>
          <Image
            cachePolicy="memory-disk"
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
        <Text style={styles.matchResultText}>{t('tutorial.preview.matched')}</Text>
      </View>
      <Text style={styles.matchNames}>Lina × Mia</Text>
    </LinearGradient>
  );
}

function ChatVisual({ height }: { height: number }) {
  const { t } = useTranslation();

  return (
    <LinearGradient colors={['#EDF7F3', '#F4F2FF', '#FFFFFF']} style={[styles.visual, { height }]}>
      <View style={styles.chatHeader}>
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          source={{ uri: TUTORIAL_PHOTOS.mia }}
          style={styles.chatAvatar}
          transition={180}
        />
        <View style={styles.chatHeaderCopy}>
          <Text style={styles.chatName}>Mia</Text>
          <Text style={styles.chatPresence}>{t('tutorial.preview.online')}</Text>
        </View>
        <IllustratedIcon size={36} source={illustratedIcons.translation} />
      </View>
      <View style={styles.chatThread}>
        <View style={styles.theirBubble}>
          <Text style={styles.theirMessage}>What kind of music do you like?</Text>
          <View style={styles.translationRow}>
            <IllustratedIcon size={22} source={illustratedIcons.translation} />
            <Text style={styles.translationText}>{t('tutorial.preview.translation')}</Text>
          </View>
        </View>
        <View style={styles.mineBubble}>
          <Text style={styles.mineMessage}>{t('tutorial.preview.reply')}</Text>
          <Text style={styles.sentText}>{t('tutorial.preview.sent')}</Text>
        </View>
      </View>
      <View style={styles.chatComposer}>
        <Text style={styles.composerPlaceholder}>{t('tutorial.preview.composer')}</Text>
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
    maxWidth: layout.maxContentWidth,
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
  skipText: { ...typography.caption, color: palette.inkMuted, fontWeight: '800' },
  segments: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  segmentTrack: {
    backgroundColor: '#DEDEE3',
    borderRadius: radius.pill,
    flex: 1,
    height: 4,
    overflow: 'hidden',
  },
  segmentFill: { borderRadius: radius.pill, height: '100%', width: '100%' },
  contentScroll: { flex: 1, minHeight: 0 },
  content: { flexGrow: 1, paddingBottom: spacing.xs },
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
  liveText: { color: palette.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  distancePill: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  distanceText: { color: palette.ink, fontSize: 11, fontWeight: '900' },
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
  passMarkText: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  pickMark: { backgroundColor: palette.pink },
  pickMarkText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  discoverCopy: { bottom: 16, left: 16, position: 'absolute', right: 16 },
  discoverNameRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  discoverFlag: { borderRadius: 5, height: 20, width: 28 },
  discoverName: { color: palette.white, fontSize: 24, fontWeight: '900', letterSpacing: -0.7 },
  discoverMeta: { color: 'rgba(255,255,255,0.84)', fontSize: 11, marginTop: 3 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  profileTag: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  profileTagText: { color: palette.white, fontSize: 11, fontWeight: '800' },
  matchOverline: {
    color: '#6C5400',
    fontSize: 11,
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
  matchResultText: { color: palette.white, fontSize: 11, fontWeight: '900' },
  matchNames: {
    color: palette.ink,
    fontSize: 11,
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
  chatPresence: { color: '#16845D', fontSize: 11, fontWeight: '800', marginTop: 2 },
  chatThread: { flex: 1, gap: 10, justifyContent: 'center', paddingHorizontal: 16 },
  theirBubble: {
    alignSelf: 'flex-start',
    backgroundColor: palette.white,
    borderRadius: 18,
    borderTopLeftRadius: 6,
    maxWidth: '82%',
    padding: 12,
  },
  theirMessage: { color: palette.ink, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  translationRow: {
    alignItems: 'center',
    borderTopColor: '#ECECEF',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
    paddingTop: 7,
  },
  translationText: { color: '#176E4D', fontSize: 11, fontWeight: '800' },
  mineBubble: {
    alignSelf: 'flex-end',
    backgroundColor: palette.ink,
    borderRadius: 18,
    borderTopRightRadius: 6,
    maxWidth: '78%',
    padding: 12,
  },
  mineMessage: { color: palette.white, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  sentText: { color: 'rgba(255,255,255,0.62)', fontSize: 11, marginTop: 5, textAlign: 'right' },
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
  composerPlaceholder: { color: palette.inkMuted, flex: 1, fontSize: 11 },
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
  eyebrow: { ...typography.overline },
  title: { ...typography.display, color: palette.ink, marginTop: 6 },
  titleCompact: { ...typography.title },
  body: { ...typography.bodySm, color: palette.inkMuted, marginTop: 8 },
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
    minHeight: 44,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  noteText: { ...typography.caption, color: palette.ink, flex: 1, fontWeight: '800' },
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
  tipLabel: { ...typography.caption, color: palette.ink, fontWeight: '900' },
  tipText: { ...typography.caption, color: palette.inkMuted, marginTop: 2 },
  footer: {
    paddingBottom: 10,
    paddingTop: 12,
  },
  footerActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  backButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 54,
    width: 54,
  },
  primary: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 54,
  },
  busy: { opacity: 0.68 },
  primaryText: { ...typography.subheading, color: palette.white, fontWeight: '900' },
});
