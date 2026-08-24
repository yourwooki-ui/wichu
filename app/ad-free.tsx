import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { palette, radius } from '@/constants/theme';
import { AD_FREE_PRODUCT, GOLD_PRODUCT } from '@/features/monetization/constants/products';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';

const GOLD_BENEFITS = [
  '골드 다이아몬드 배지와 프로필 테두리',
  '내 프로필 방문자 확인',
  'Discover 노출 우선순위',
  '모든 광고 제거',
  '광고 없이 무제한 되돌리기',
];

export default function PassDetailRoute() {
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
        <View style={[styles.mark, adFreeOnly && styles.markPink]}>
          {adFreeOnly ? (
            <Ionicons color={palette.pink} name="remove-circle" size={29} />
          ) : (
            <IllustratedIcon size={76} source={illustratedIcons.goldPremium} />
          )}
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
          {(adFreeOnly ? ['자동 노출 광고 제거'] : GOLD_BENEFITS).map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={[styles.check, !adFreeOnly && styles.checkGold]}>
                <Ionicons
                  color={adFreeOnly ? palette.white : '#4A3500'}
                  name="checkmark"
                  size={14}
                />
              </View>
              <Text style={styles.benefitText}>{benefit}</Text>
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

        <Pressable onPress={showProviderPending} style={styles.purchase}>
          <Text style={styles.purchaseText}>
            {entitlement.data?.tier === (adFreeOnly ? 'ad_free' : 'gold')
              ? '이용 중'
              : '구매 준비 중'}
          </Text>
        </Pressable>
        <Pressable onPress={showProviderPending} style={styles.restore}>
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
  markPink: { backgroundColor: '#FFE4ED', borderRadius: 31, height: 62, width: 62 },
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
    borderRadius: 22,
    marginTop: 27,
    padding: 18,
  },
  priceLabel: { color: palette.inkMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  price: { color: palette.ink, fontSize: 17, fontWeight: '900', marginTop: 6 },
  priceHint: { color: palette.inkMuted, fontSize: 10, marginTop: 4 },
  purchase: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    justifyContent: 'center',
    marginTop: 14,
    minHeight: 52,
  },
  purchaseText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  restore: { paddingHorizontal: 18, paddingVertical: 15 },
  restoreText: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  legal: {
    color: palette.inkMuted,
    fontSize: 10,
    lineHeight: 13,
    maxWidth: 315,
    textAlign: 'center',
  },
});
