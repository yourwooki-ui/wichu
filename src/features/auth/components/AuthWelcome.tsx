import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandWordmark } from '@/components/BrandWordmark';
import { PrimaryButton } from '@/components/PrimaryButton';
import { palette, radius, spacing, typography } from '@/constants/theme';
import { LanguagePicker } from '@/features/auth/components/LanguagePicker';

const WELCOME_PROFILE_IMAGE =
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=90';

type AuthWelcomeProps = {
  onCreateAccount: () => void;
  onSignIn: () => void;
};

export function AuthWelcome({ onCreateAccount, onSignIn }: AuthWelcomeProps) {
  const { t } = useTranslation();
  // 사진 속 인물을 가리키는 미리보기 카드는 사진이 실제로 보일 때만 띄운다.
  // 실패 판정에 onError를 쓸 수 없다. 느린 네트워크에서는 요청이 에러 없이 멈춰 있어
  // onError가 끝내 불리지 않기 때문에, "로드 완료"를 기준으로 삼는다.
  const [heroReady, setHeroReady] = useState(false);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.page}>
        {/*
          첫 화면이 외부 CDN 한 장에 좌우되지 않도록 브랜드 배경을 항상 먼저 깐다.
          네트워크가 느리거나 끊겨도 검정 여백 대신 의도된 화면이 보인다.
        */}
        <LinearGradient
          colors={['#17171C', '#0B0B0F', palette.trueBlack]}
          locations={[0, 0.55, 1]}
          style={styles.brandBed}
        />
        <LinearGradient
          colors={['rgba(255,45,111,0.22)', 'rgba(255,45,111,0)']}
          end={{ x: 0.5, y: 1 }}
          start={{ x: 0.5, y: 0 }}
          style={styles.brandGlow}
        />
        <Image
          source={{ uri: WELCOME_PROFILE_IMAGE }}
          cachePolicy="memory-disk"
          contentFit="cover"
          contentPosition="center"
          onError={() => setHeroReady(false)}
          onLoad={() => setHeroReady(true)}
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
          <View style={[styles.profilePreview, !heroReady && styles.hidden]}>
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
            <PrimaryButton
              label={t('auth.signIn')}
              onPress={onSignIn}
              tone="dark"
              variant="outline"
            />
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
  brandBed: { position: 'absolute', inset: 0 },
  brandGlow: { position: 'absolute', height: '46%', left: 0, right: 0, top: 0 },
  profileImage: { position: 'absolute', inset: 0 },
  gradient: { position: 'absolute', inset: 0 },
  hidden: { display: 'none' },
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
  profileName: { ...typography.title, color: palette.white },
  tags: { marginTop: spacing.sm, flexDirection: 'row', gap: 7 },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.34)',
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  tagText: { ...typography.caption, color: palette.white, fontWeight: '800' },
  pitch: {
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#333338',
  },
  kicker: { ...typography.overline, color: palette.lime },
  title: {
    maxWidth: 390,
    marginTop: spacing.xs,
    color: palette.white,
    fontSize: 33,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1,
  },
  subtitle: { ...typography.bodySm, color: palette.darkMuted, marginTop: 6, maxWidth: 390 },
  actions: { marginTop: 18, gap: 9 },
  ageNotice: {
    marginTop: 2,
    color: '#7F7F88',
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
  },
});
