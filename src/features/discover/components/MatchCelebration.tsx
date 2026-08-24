import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppModal } from '@/components/AppModal';
import { CountryFlag } from '@/components/CountryFlag';
import { palette, radius } from '@/constants/theme';
import type { Profile } from '@/types/profile';

type MatchCelebrationProps = {
  onChat: () => void;
  onContinue: () => void;
  profile: Profile | null;
};

export function MatchCelebration({ onChat, onContinue, profile }: MatchCelebrationProps) {
  return (
    <AppModal
      animationType="fade"
      onRequestClose={onContinue}
      transparent
      visible={Boolean(profile)}
    >
      <View style={styles.backdrop}>
        {profile ? (
          <View accessibilityViewIsModal style={styles.card}>
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
                <Ionicons color={palette.white} name="heart" size={22} />
              </View>
            </LinearGradient>
            <Text style={styles.eyebrow}>IT&apos;S A MATCH</Text>
            <View style={styles.nameRow}>
              <Text style={styles.title}>{profile.name}님과 연결됐어요</Text>
              <CountryFlag compact countryCode={profile.countryCode} style={styles.flag} />
            </View>
            <Text style={styles.body}>서로 Pick한 지금, 가볍게 첫인사를 건네보세요.</Text>
            <Pressable accessibilityRole="button" onPress={onChat} style={styles.primaryAction}>
              <Ionicons color={palette.white} name="chatbubble" size={17} />
              <Text style={styles.primaryActionText}>첫 인사 보내기</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={styles.secondaryAction}
            >
              <Text style={styles.secondaryActionText}>계속 발견하기</Text>
            </Pressable>
          </View>
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
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 18,
  },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 5 },
  title: { color: palette.ink, fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  flag: { borderRadius: 4, height: 14, width: 21 },
  body: {
    color: palette.inkMuted,
    fontSize: 11,
    lineHeight: 17,
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
    minHeight: 42,
  },
  secondaryActionText: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
});
