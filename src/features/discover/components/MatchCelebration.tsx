import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  Pressable,
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

  useEffect(() => {
    if (!visible) {
      enter.setValue(0);
      return;
    }

    // 매치는 이 앱에서 가장 중요한 순간이다. 조용히 떠 있기만 하지 않게 한다.
    hapticsService.success();

    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (cancelled) return;
      if (reduceMotion) {
        enter.setValue(1);
        return;
      }
      Animated.spring(enter, {
        bounciness: 9,
        speed: 13,
        toValue: 1,
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    });

    return () => {
      cancelled = true;
    };
  }, [enter, visible]);

  const cardStyle = {
    opacity: enter,
    transform: [
      { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
      { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
    ],
  };

  return (
    <AppModal
      animationType="fade"
      onRequestClose={onContinue}
      transparent
      visible={Boolean(profile)}
    >
      <View style={styles.backdrop}>
        {profile ? (
          <Animated.View accessibilityViewIsModal style={[styles.card, cardStyle]}>
            <LinearGradient colors={['#FFF1F6', '#FFFFFF']} style={styles.hero}>
              <View style={styles.photoRing}>
                <Image
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  source={{ uri: profile.photos[0] }}
                  style={styles.photo}
                />
              </View>
              <View style={styles.matchMark}>
                <Ionicons color={palette.white} name="checkmark" size={22} />
              </View>
            </LinearGradient>
            <Text style={styles.eyebrow}>MATCH</Text>
            <View style={styles.nameRow}>
              <Text style={styles.title}>{profile.name}님과 매치됐어요</Text>
              <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
            </View>
            <Text style={styles.body}>이제 서로 메시지를 보낼 수 있어요.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={onChat}
              style={({ pressed }) => [styles.primaryAction, pressed && pressFeedback.control]}
            >
              <Ionicons color={palette.white} name="chatbubble" size={17} />
              <Text style={styles.primaryActionText}>메시지 보내기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={({ pressed }) => [styles.secondaryAction, pressed && pressFeedback.control]}
            >
              <Text style={styles.secondaryActionText}>발견 계속하기</Text>
            </Pressable>
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
    maxWidth: 380,
    overflow: 'hidden',
    paddingBottom: 20,
    paddingHorizontal: 22,
    width: '100%',
  },
  hero: { alignItems: 'center', alignSelf: 'stretch', paddingBottom: 23, paddingTop: 28 },
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
    bottom: 12,
    height: 44,
    justifyContent: 'center',
    position: 'absolute',
    width: 44,
  },
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
