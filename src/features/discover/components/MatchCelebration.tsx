import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import { PrimaryButton } from '@/components/PrimaryButton';
import { motionDuration, motionScale, motionSpring } from '@/constants/motion';
import { palette } from '@/constants/theme';
import { useReduceMotion } from '@/hooks/use-reduce-motion';
import { hapticsService } from '@/services/haptics-service';
import type { Profile } from '@/types/profile';

type MatchCelebrationProps = {
  onChat: () => void;
  onContinue: () => void;
  profile: Profile | null;
};

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function MatchCelebration({ onChat, onContinue, profile }: MatchCelebrationProps) {
  const visible = Boolean(profile);
  const [enter] = useState(() => new Animated.Value(0));
  const [contentEnter] = useState(() => new Animated.Value(0));
  const [markEnter] = useState(() => new Animated.Value(0));
  const reduceMotion = useReduceMotion();
  const announcedProfile = useRef<string | null>(null);
  const profileId = profile?.id;
  const profileName = profile?.name;

  useEffect(() => {
    if (!profileId) {
      announcedProfile.current = null;
      return;
    }
    if (announcedProfile.current === profileId) return;
    announcedProfile.current = profileId;
    hapticsService.success();
    try {
      AccessibilityInfo.announceForAccessibility(`${profileName}님과 매치됐어요`);
    } catch {
      // Unsupported accessibility module must not block opening the match.
    }
  }, [profileId, profileName]);

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      contentEnter.setValue(0);
      markEnter.setValue(0);
      return;
    }

    if (reduceMotion) {
      enter.setValue(1);
      contentEnter.setValue(1);
      markEnter.setValue(1);
      return;
    }

    const animation = Animated.parallel([
      Animated.spring(enter, {
        ...motionSpring.celebration,
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
      }),
      Animated.sequence([
        Animated.delay(90),
        Animated.spring(markEnter, {
          ...motionSpring.pressIn,
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
      Animated.sequence([
        Animated.delay(motionDuration.feedback),
        Animated.timing(contentEnter, {
          duration: motionDuration.fast,
          toValue: 1,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    ]);
    animation.start();

    return () => {
      // Stop the sequence itself, including delays, when closing or reducing motion.
      animation.stop();
    };
  }, [contentEnter, enter, markEnter, profileId, reduceMotion, visible]);

  const cardStyle = {
    opacity: enter,
    transform: [
      {
        scale: enter.interpolate({
          inputRange: [0, 1],
          outputRange: [motionScale.celebrationFrom, 1],
        }),
      },
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
    ],
  };
  const contentStyle = {
    opacity: contentEnter,
    transform: [
      { translateY: contentEnter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
    ],
  };
  const markStyle = {
    opacity: markEnter,
    transform: [{ scale: markEnter.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) }],
  };

  const handleChat = () => {
    hapticsService.selection();
    onChat();
  };

  const handleContinue = () => {
    hapticsService.selection();
    onContinue();
  };

  return (
    <AppModal
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={handleContinue}
      transparent
      visible={Boolean(profile)}
    >
      <View style={styles.backdrop}>
        {profile ? (
          <Animated.View
            accessibilityLabel={`${profile.name}님과 매치됐어요. 이제 서로 메시지를 보낼 수 있어요.`}
            accessibilityViewIsModal
            style={[styles.card, cardStyle]}
          >
            <ScrollView
              contentContainerStyle={styles.cardContent}
              showsVerticalScrollIndicator={false}
              style={styles.cardScroll}
            >
              <LinearGradient colors={[palette.trueBlack, palette.ink]} style={styles.hero}>
                <Text style={styles.heroTitle}>IT’S A{'\n'}MATCH!</Text>
                <View style={styles.profileCluster}>
                  <View style={styles.haloOuter} />
                  <View style={styles.haloInner} />
                  <View style={styles.photoRing}>
                    <Image
                      cachePolicy="memory-disk"
                      contentFit="cover"
                      source={{ uri: profile.photos[0] }}
                      style={styles.photo}
                    />
                  </View>
                  <Animated.View style={[styles.matchMark, markStyle]}>
                    <Ionicons color={palette.ink} name="heart" size={22} />
                  </Animated.View>
                </View>
              </LinearGradient>
              <Animated.View style={[styles.content, contentStyle]}>
                <Text style={styles.eyebrow}>TWO PEOPLE. ONE PICK.</Text>
                <View style={styles.nameRow}>
                  <Text style={styles.title}>{profile.name}님과 매치됐어요</Text>
                  <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
                </View>
                <Text style={styles.body}>서로의 선택이 닿았어요. 지금 가볍게 인사해보세요.</Text>
                <View style={styles.actions}>
                  <PrimaryButton
                    icon="chatbubble"
                    label="메시지 보내기"
                    onPress={handleChat}
                    tone="dark"
                  />
                  <PrimaryButton
                    label="발견 계속하기"
                    onPress={handleContinue}
                    tone="dark"
                    variant="ghost"
                    size="sm"
                  />
                </View>
              </Animated.View>
            </ScrollView>
          </Animated.View>
        ) : null}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.78)',
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderColor: palette.darkLine,
    borderWidth: 1,
    borderRadius: 30,
    maxHeight: '92%',
    maxWidth: 380,
    overflow: 'hidden',
    width: '100%',
  },
  cardScroll: { minHeight: 0, width: '100%' },
  cardContent: { paddingBottom: 18 },
  hero: { alignItems: 'center', alignSelf: 'stretch', paddingBottom: 10, paddingTop: 30 },
  heroTitle: {
    color: palette.lime,
    fontSize: 40,
    lineHeight: 41,
    fontWeight: '900',
    letterSpacing: -1.5,
    textAlign: 'center',
    marginBottom: 24,
  },
  profileCluster: { alignItems: 'center', height: 178, justifyContent: 'center', width: 218 },
  haloOuter: {
    borderColor: palette.darkLine,
    borderWidth: 1,
    borderRadius: 100,
    height: 154,
    position: 'absolute',
    width: 218,
    transform: [{ rotate: '-22deg' }],
  },
  haloInner: {
    borderColor: '#484832',
    borderWidth: 1,
    borderRadius: 100,
    height: 160,
    position: 'absolute',
    width: 194,
    transform: [{ rotate: '24deg' }],
  },
  photoRing: {
    borderColor: palette.pink,
    borderRadius: 28,
    borderWidth: 2,
    padding: 4,
    transform: [{ rotate: '-7deg' }],
  },
  photo: { backgroundColor: palette.graphite, borderRadius: 22, height: 144, width: 114 },
  matchMark: {
    alignItems: 'center',
    backgroundColor: palette.lime,
    borderColor: palette.ink,
    borderRadius: 22,
    borderWidth: 3,
    bottom: 0,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 34,
    width: 44,
  },
  content: { alignItems: 'center', paddingHorizontal: 22, width: '100%' },
  eyebrow: {
    color: palette.darkMuted,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 18,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 12,
    width: '100%',
    justifyContent: 'center',
  },
  title: {
    color: palette.white,
    flexShrink: 1,
    textAlign: 'center',
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: -0.6,
  },
  flag: { borderRadius: 4, height: 14, width: 21 },
  body: {
    color: palette.darkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  actions: { gap: 8, marginTop: 24, width: '100%' },
});
