import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import { palette, pressFeedback, radius } from '@/constants/theme';
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

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      contentEnter.setValue(0);
      markEnter.setValue(0);
      return;
    }

    // 매치 순간은 한 번만 울리고, 카드 → 인증 마크 → 안내 순서로 시선이 흐르게 한다.
    hapticsService.success();
    if (profile) {
      try {
        AccessibilityInfo.announceForAccessibility(`${profile.name}님과 매치됐어요`);
      } catch {
        // 접근성 네이티브 모듈이 준비되지 않아도 매치 화면은 계속 보여준다.
      }
    }

    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) {
          enter.setValue(1);
          contentEnter.setValue(1);
          markEnter.setValue(1);
          return;
        }
        Animated.parallel([
          Animated.spring(enter, {
            bounciness: 8,
            speed: 14,
            toValue: 1,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          Animated.sequence([
            Animated.delay(90),
            Animated.spring(markEnter, {
              bounciness: 11,
              speed: 16,
              toValue: 1,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
          Animated.sequence([
            Animated.delay(120),
            Animated.timing(contentEnter, {
              duration: 180,
              toValue: 1,
              useNativeDriver: USE_NATIVE_DRIVER,
            }),
          ]),
        ]).start();
      })
      .catch(() => {
        if (cancelled) return;
        // 접근성 조회 실패 시 모션 없이 최종 상태를 노출한다.
        enter.setValue(1);
        contentEnter.setValue(1);
        markEnter.setValue(1);
      });

    return () => {
      cancelled = true;
      enter.stopAnimation();
      contentEnter.stopAnimation();
      markEnter.stopAnimation();
    };
  }, [contentEnter, enter, markEnter, profile, visible]);

  const cardStyle = {
    opacity: enter,
    transform: [
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
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
      animationType="fade"
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
              <LinearGradient colors={['#FFF1F6', '#FFFFFF']} style={styles.hero}>
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
                    <Ionicons color={palette.white} name="checkmark" size={22} />
                  </Animated.View>
                </View>
              </LinearGradient>
              <Animated.View style={[styles.content, contentStyle]}>
                <Text style={styles.eyebrow}>IT&apos;S A MATCH</Text>
                <View style={styles.nameRow}>
                  <Text style={styles.title}>{profile.name}님과 매치됐어요</Text>
                  <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
                </View>
                <Text style={styles.body}>서로의 선택이 닿았어요. 지금 가볍게 인사해보세요.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleChat}
                  style={({ pressed }) => [styles.primaryAction, pressed && pressFeedback.control]}
                >
                  <Ionicons color={palette.white} name="chatbubble" size={17} />
                  <Text style={styles.primaryActionText}>메시지 보내기</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleContinue}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    pressed && pressFeedback.control,
                  ]}
                >
                  <Text style={styles.secondaryActionText}>발견 계속하기</Text>
                </Pressable>
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
    backgroundColor: 'rgba(13,13,17,0.62)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 30,
    maxHeight: '92%',
    maxWidth: 380,
    overflow: 'hidden',
    width: '100%',
  },
  cardScroll: { minHeight: 0, width: '100%' },
  cardContent: { paddingBottom: 18 },
  hero: { alignItems: 'center', alignSelf: 'stretch', paddingBottom: 18, paddingTop: 24 },
  profileCluster: { alignItems: 'center', height: 128, justifyContent: 'center', width: 150 },
  haloOuter: {
    backgroundColor: 'rgba(255,45,111,0.08)',
    borderRadius: 69,
    height: 138,
    position: 'absolute',
    width: 138,
  },
  haloInner: {
    backgroundColor: 'rgba(255,45,111,0.11)',
    borderRadius: 57,
    height: 114,
    position: 'absolute',
    width: 114,
  },
  photoRing: {
    borderColor: palette.pink,
    borderRadius: 55,
    borderWidth: 3,
    padding: 4,
  },
  photo: { borderRadius: 46, height: 92, width: 92 },
  matchMark: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderColor: palette.white,
    borderRadius: 22,
    borderWidth: 3,
    bottom: 0,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
    width: 44,
  },
  content: { alignItems: 'center', paddingHorizontal: 22, width: '100%' },
  eyebrow: {
    color: palette.pink,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 18,
  },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 5 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  flag: { borderRadius: 4, height: 14, width: 21 },
  body: {
    color: palette.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 7,
    textAlign: 'center',
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 17,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
    width: '100%',
  },
  primaryActionText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  secondaryAction: {
    alignItems: 'center',
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: 7,
    minHeight: 44,
  },
  secondaryActionText: { color: palette.inkMuted, fontSize: 12, fontWeight: '800' },
});
