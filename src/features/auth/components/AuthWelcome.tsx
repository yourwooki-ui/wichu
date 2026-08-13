import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette, radius, spacing } from '@/constants/theme';
import { LanguagePicker } from '@/features/auth/components/LanguagePicker';

const WELCOME_PROFILE_IMAGE =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=90';

type AuthWelcomeProps = {
  onCreateAccount: () => void;
  onSignIn: () => void;
};

export function AuthWelcome({ onCreateAccount, onSignIn }: AuthWelcomeProps) {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <Image
          source={{ uri: WELCOME_PROFILE_IMAGE }}
          cachePolicy="memory-disk"
          contentFit="cover"
          contentPosition="center"
          transition={250}
          style={styles.profileImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.18)', '#000000']}
          locations={[0, 0.25, 0.48, 0.76]}
          style={styles.gradient}
        />

        <View style={styles.topRow}>
          <BrandWordmark size={27} />
          <LanguagePicker dark />
        </View>

        <View style={styles.content}>
          <View style={styles.profilePreview}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>Lina, 23</Text>
              <Ionicons name="checkmark-circle" size={20} color={palette.pink} />
            </View>
            <View style={styles.tags}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Design</Text>
              </View>
              <View style={styles.tag}>
                <Text style={styles.tagText}>Travel</Text>
              </View>
            </View>
          </View>

          <View style={styles.pitch}>
            <Text style={styles.kicker}>{t('auth.brandKicker')}</Text>
            <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.welcomeBody')}</Text>
          </View>

          <View style={styles.actions}>
            <PrimaryButton label={t('auth.createAccount')} onPress={onCreateAccount} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('auth.signIn')}
              onPress={onSignIn}
              style={({ pressed }) => [styles.signInButton, pressed && styles.pressed]}
            >
              <Text style={styles.signInLabel}>{t('auth.signIn')}</Text>
            </Pressable>
            <Text style={styles.ageNotice}>{t('auth.ageNotice')}</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#08080A',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    maxHeight: Platform.select({ web: 900 }),
    overflow: 'hidden',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: '#242429',
    backgroundColor: palette.trueBlack,
  },
  profileImage: { position: 'absolute', inset: 0 },
  gradient: { position: 'absolute', inset: 0 },
  topRow: {
    zIndex: 2,
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  content: {
    zIndex: 2,
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  profilePreview: { marginBottom: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  profileName: { color: palette.white, fontSize: 25, lineHeight: 30, fontWeight: '900' },
  tags: { marginTop: spacing.sm, flexDirection: 'row', gap: 7 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  tagText: { color: palette.white, fontSize: 11, fontWeight: '800' },
  pitch: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#333338',
  },
  kicker: { color: palette.lime, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  title: {
    maxWidth: 390,
    marginTop: spacing.xs,
    color: palette.white,
    fontSize: 33,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 390,
    marginTop: 6,
    color: palette.darkMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  actions: { marginTop: 18, gap: 9 },
  signInButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A3A40',
    borderRadius: radius.md,
    backgroundColor: 'rgba(17,17,17,0.84)',
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  signInLabel: { color: palette.white, fontSize: 15, fontWeight: '900' },
  ageNotice: {
    marginTop: 2,
    color: '#7F7F88',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
