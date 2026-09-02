import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette, radius, spacing, typography } from '@/constants/theme';
import { LanguagePicker } from '@/features/auth/components/LanguagePicker';

const WELCOME_HERO = require('../../../../assets/brand/wichu-welcome-inclusive-v1.jpg');

type AuthWelcomeProps = {
  onCreateAccount: () => void;
  onSignIn: () => void;
};

export function AuthWelcome({ onCreateAccount, onSignIn }: AuthWelcomeProps) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const heroHeight = Math.max(260, Math.min(520, height * 0.56));

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.pageContent}
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
        >
          <View style={[styles.heroVisual, { height: heroHeight }]}>
            <Image
              accessibilityIgnoresInvertColors
              cachePolicy="memory-disk"
              contentFit="cover"
              contentPosition="top center"
              source={WELCOME_HERO}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(252,250,248,0)', 'rgba(252,250,248,0.08)', '#FCFAF8']}
              locations={[0.54, 0.76, 1]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={styles.topRow}>
            <BrandWordmark color={palette.ink} size={27} />
            <LanguagePicker />
          </View>

          <View style={styles.content}>
            <Text style={styles.kicker}>{t('auth.brandKicker')}</Text>
            <Text style={styles.title}>{t('auth.welcomeTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.welcomeBody')}</Text>

            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Ionicons color={palette.pink} name="people" size={15} />
                <Text style={styles.trustText}>{t('auth.mutualPick')}</Text>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <Ionicons color="#6A8B00" name="shield-checkmark" size={15} />
                <Text style={styles.trustText}>{t('auth.safetyFirst')}</Text>
              </View>
            </View>

            <View style={styles.actions}>
              <PrimaryButton label={t('auth.createAccount')} onPress={onCreateAccount} />
              <PrimaryButton label={t('auth.signIn')} onPress={onSignIn} variant="outline" />
              <Text style={styles.ageNotice}>{t('auth.ageNotice')}</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    alignItems: 'center',
    backgroundColor: '#E9E7E4',
    flex: 1,
    justifyContent: 'center',
  },
  page: {
    backgroundColor: '#FCFAF8',
    flex: 1,
    maxHeight: Platform.select({ web: 900 }),
    maxWidth: 430,
    overflow: 'hidden',
    width: '100%',
  },
  scroll: { flex: 1, minHeight: 0 },
  pageContent: { flexGrow: 1 },
  heroVisual: { minHeight: 260 },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 20,
    position: 'absolute',
    right: 20,
    top: 14,
    zIndex: 2,
  },
  content: {
    backgroundColor: '#FCFAF8',
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  kicker: { ...typography.overline, color: palette.pink, letterSpacing: 1.1 },
  title: {
    color: palette.ink,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 38,
    marginTop: spacing.xs,
    maxWidth: 390,
  },
  subtitle: {
    ...typography.bodySm,
    color: palette.inkMuted,
    lineHeight: 19,
    marginTop: 7,
    maxWidth: 390,
  },
  trustRow: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trustItem: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  trustText: { color: palette.ink, fontSize: 11, fontWeight: '800' },
  trustDivider: { backgroundColor: palette.line, height: 13, marginHorizontal: 9, width: 1 },
  actions: { gap: 9, marginTop: 16 },
  ageNotice: {
    color: palette.inkMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 1,
    textAlign: 'center',
  },
});
