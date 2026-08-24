import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { palette, radius, touchSlop, typography } from '@/constants/theme';
import { AD_FREE_PRODUCT, GOLD_PRODUCT } from '@/features/monetization/constants/products';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';

const GOLD_BENEFITS = [
  { label: '골드 다이아몬드 배지와 프로필 테두리', icon: illustratedIcons.goldPremium },
  { label: '내 프로필 방문자 확인', icon: illustratedIcons.connections },
  { label: 'Discover 노출 우선순위', icon: illustratedIcons.discoveryVisible },
  { label: '모든 광고 제거', icon: illustratedIcons.adFree },
  { label: '광고 없이 무제한 되돌리기', icon: illustratedIcons.rewind },
] as const;

const AD_FREE_BENEFITS = [{ label: '자동 노출 광고 제거', icon: illustratedIcons.adFree }] as const;

/** 결제 연동 전에는 직접 접근도 막는다 (딥링크·뒤로가기 포함). */
export default function PassDetailRoute() {
  if (!MONETIZATION_ENABLED) return <Redirect href="/(tabs)/discover" />;
  return <PassDetailScreen />;
}

function PassDetailScreen() {
  const router = useRouter();
  const { product } = useLocalSearchParams<{ product?: string }>();
  const entitlement = usePassEntitlement();
  const adFreeOnly = product === 'ad-free';

  const showProviderPending = () =>
    Alert.alert(
      '결제 연결 준비 중',
      '상품과 권한 구조는 준비됐어요. App Store·Google Play 상품 ID 연결 후 실제 구매가 활성화됩니다.',
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="뒤로" onPress={() => router.back()} style={styles.back}>
          <Ionicons color={palette.ink} name="chevron-back" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{adFreeOnly ? 'Ad-Free' : 'Gold Pass'}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.mark}>
          <IllustratedIcon
            size={78}
            source={adFreeOnly ? illustratedIcons.adFree : illustratedIcons.goldPass}
          />
        </View>
        <Text style={styles.eyebrow}>{adFreeOnly ? 'WICHU AD-FREE' : 'WICHU GOLD PASS'}</Text>
        <Text style={styles.title}>
          {adFreeOnly ? '광고 없이 깔끔하게' : '더 빛나고, 먼저 발견되게'}
        </Text>
        <Text style={styles.description}>
          {adFreeOnly
            ? '핵심 기능은 그대로 유지하고 앱 내 광고만 제거해요.'
            : '프로필 표현과 발견 기회를 강화하는 WICHU의 프리미엄 패스예요.'}
        </Text>

        <View style={styles.benefits}>
          {(adFreeOnly ? AD_FREE_BENEFITS : GOLD_BENEFITS).map((benefit) => (
            <View key={benefit.label} style={styles.benefitRow}>
              <IllustratedIcon size={36} source={benefit.icon} />
              <Text style={styles.benefitText}>{benefit.label}</Text>
              <View style={[styles.check, !adFreeOnly && styles.checkGold]}>
                <Ionicons
                  color={adFreeOnly ? palette.white : '#4A3500'}
                  name="checkmark"
                  size={14}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>월간 이용권</Text>
          <Text style={styles.price}>
            {adFreeOnly ? AD_FREE_PRODUCT.fallbackPriceLabelKo : GOLD_PRODUCT.fallbackPriceLabelKo}
          </Text>
          <Text style={styles.priceHint}>
            {adFreeOnly ? '매월 자동 갱신 · 언제든 취소 가능' : '자동 갱신 · 언제든 취소 가능'}
          </Text>
        </View>

        <View style={styles.purchaseSlot}>
          <PrimaryButton
            label={
              entitlement.data?.tier === (adFreeOnly ? 'ad_free' : 'gold')
                ? '이용 중'
                : '구매 준비 중'
            }
            onPress={showProviderPending}
            variant="secondary"
          />
        </View>
        <Pressable hitSlop={touchSlop.link} onPress={showProviderPending} style={styles.restore}>
          <IllustratedIcon size={24} source={illustratedIcons.purchase} />
          <Text style={styles.restoreText}>구매 복원</Text>
        </Pressable>
        <Text style={styles.legal}>
          구매 전 가격, 갱신 주기와 취소 조건을 App Store 또는 Google Play 결제창에서 확인합니다.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F8F8FA', flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  back: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42 },
  headerTitle: { color: palette.ink, fontSize: 15, fontWeight: '900' },
  content: { alignItems: 'center', paddingBottom: 30, paddingHorizontal: 22, paddingTop: 22 },
  mark: {
    alignItems: 'center',
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  eyebrow: { color: '#A2760D', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginTop: 18 },
  title: {
    color: palette.ink,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginTop: 7,
    textAlign: 'center',
  },
  description: {
    color: palette.inkMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: 310,
    textAlign: 'center',
  },
  benefits: { alignSelf: 'stretch', gap: 14, marginTop: 28 },
  benefitRow: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  check: {
    alignItems: 'center',
    backgroundColor: palette.pink,
    borderRadius: 11,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  checkGold: { backgroundColor: '#FFD35A' },
  benefitText: { color: palette.ink, flex: 1, fontSize: 13, fontWeight: '800' },
  priceCard: {
    alignSelf: 'stretch',
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    marginTop: 27,
    padding: 18,
  },
  priceLabel: { ...typography.overline, color: palette.inkMuted },
  price: { ...typography.heading, color: palette.ink, marginTop: 6 },
  priceHint: { ...typography.caption, color: palette.inkMuted, marginTop: 4 },
  purchaseSlot: { alignSelf: 'stretch', marginTop: 14 },
  restore: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  restoreText: {
    ...typography.caption,
    color: palette.ink,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  legal: {
    ...typography.caption,
    color: palette.inkMuted,
    maxWidth: 315,
    textAlign: 'center',
  },
});
