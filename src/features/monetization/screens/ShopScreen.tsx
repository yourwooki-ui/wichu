import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AppTabHeader } from '@/components/AppTabHeader';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { MotionIllustratedIcon } from '@/components/MotionIllustratedIcon';
import { Screen } from '@/components/Screen';
import { getPassIllustration, illustratedIcons } from '@/constants/illustrated-icons';
import { sectionEntering } from '@/constants/motion';
import { elevation, palette, radius, typography } from '@/constants/theme';
import { AD_FREE_PRODUCT, GOLD_PRODUCT } from '@/features/monetization/constants/products';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { productAnalyticsService } from '@/services/product-analytics-service';

const goldBenefits: {
  illustration: (typeof illustratedIcons)[keyof typeof illustratedIcons];
  title: string;
  detail: string;
}[] = [
  {
    illustration: illustratedIcons.connections,
    title: '방문자 확인',
    detail: '최근 프로필 방문자를 확인합니다',
  },
  {
    illustration: illustratedIcons.discoveryVisible,
    title: '우선 노출',
    detail: '조건이 맞는 후보에게 우선 노출됩니다',
  },
  {
    illustration: illustratedIcons.goldPremium,
    title: '골드 프로필',
    detail: '골드 테두리와 다이아몬드가 표시됩니다',
  },
  {
    illustration: illustratedIcons.adFree,
    title: '광고 제거',
    detail: '자동 광고가 표시되지 않습니다',
  },
  {
    illustration: illustratedIcons.rewind,
    title: '무제한 되돌리기',
    detail: '광고 시청 없이 되돌릴 수 있습니다',
  },
  {
    illustration: illustratedIcons.profilePhotos,
    title: '채팅 사진 전송',
    detail: '사진을 한 번에 최대 5장 보낼 수 있습니다',
  },
];

const planComparison = [
  { label: '핵심 기능', free: 'yes', adFree: 'yes', gold: 'yes' },
  { label: '자동 광고 제거', free: 'no', adFree: 'yes', gold: 'yes' },
  { label: '방문자 확인', free: 'no', adFree: 'no', gold: 'yes' },
  { label: '우선 노출', free: 'no', adFree: 'no', gold: 'yes' },
  { label: '채팅 사진', free: 'no', adFree: 'no', gold: '최대 5장' },
  { label: '되돌리기', free: '광고 1회', adFree: '광고 1회', gold: '무제한' },
];

export function ShopScreen() {
  const router = useRouter();
  const entitlement = usePassEntitlement();
  const tier = entitlement.data?.tier ?? 'free';
  const tierLabel = tier === 'gold' ? 'Gold Pass' : tier === 'ad_free' ? 'Ad-Free' : 'Free';

  useEffect(() => {
    productAnalyticsService.track('purchase_viewed', { surface: 'shop', tier }, '/shop');
  }, [tier]);

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader
        actionAccessibilityLabel="구매 복원 및 이용권 관리"
        actionIcon={illustratedIcons.purchase}
        eyebrow="상점"
        onAction={() => router.push('/ad-free')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={sectionEntering(0)} style={styles.currentPlan}>
          <View style={styles.currentPlanIcon}>
            <IllustratedIcon size={38} source={getPassIllustration(tier)} />
          </View>
          <View style={styles.currentPlanCopy}>
            <Text style={styles.currentPlanLabel}>현재 이용권</Text>
            <Text style={styles.currentPlanName}>{tierLabel}</Text>
          </View>
          <View style={[styles.activePill, tier === 'gold' && styles.activePillGold]}>
            <View style={[styles.activeDot, tier === 'gold' && styles.activeDotGold]} />
            <Text style={styles.activeText}>이용 중</Text>
          </View>
        </Animated.View>

        <Animated.View entering={sectionEntering(1)}>
          <LinearGradient colors={['#FFF9E6', '#F2D982']} style={styles.goldHero}>
            <View style={styles.goldGlow} />
            <View style={styles.goldTopRow}>
              <View style={styles.diamondMark}>
                <MotionIllustratedIcon
                  motion="shine"
                  size={52}
                  source={illustratedIcons.goldPass}
                />
              </View>
              <View>
                <Text style={styles.goldPassLabel}>WICHU GOLD PASS</Text>
                <Text style={styles.goldMicrocopy}>방문자 확인 · 광고 제거 · 우선 노출</Text>
              </View>
            </View>
            <Text style={styles.goldTitle}>Gold 기능을{`\n`}한 번에 이용하세요.</Text>
            <Text style={styles.goldDescription}>
              방문자 확인, 무제한 되돌리기, 광고 제거와 우선 노출이 포함됩니다.
            </Text>
            <View style={styles.goldHighlights}>
              {goldBenefits.slice(0, 3).map((benefit) => (
                <View key={benefit.title} style={styles.highlightChip}>
                  <IllustratedIcon size={20} source={benefit.illustration} />
                  <Text style={styles.highlightText}>{benefit.title}</Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/ad-free')}
              style={({ pressed }) => [styles.goldAction, pressed && styles.pressed]}
            >
              <Text style={styles.goldActionText}>
                {tier === 'gold' ? 'Gold Pass 관리' : '혜택과 가격 확인'}
              </Text>
              <Ionicons color={palette.white} name="arrow-forward" size={17} />
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={sectionEntering(2)}>
          <Text style={styles.sectionTitle}>나에게 맞는 이용권</Text>
          <View style={styles.planRow}>
            <Pressable
              accessibilityLabel="Ad-Free 자세히 보기"
              accessibilityRole="button"
              onPress={() => router.push('/ad-free?product=ad-free')}
              style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
            >
              <View style={styles.planIconPink}>
                <IllustratedIcon size={42} source={illustratedIcons.adFree} />
              </View>
              <Text style={styles.planName}>Ad-Free</Text>
              <Text style={styles.planDescription}>선택형 보상 광고를 제외한 자동 광고 제거</Text>
              <Text style={styles.planPrice}>{AD_FREE_PRODUCT.fallbackPriceLabelKo}</Text>
              <View style={styles.planLink}>
                <Text style={styles.planLinkText}>자세히 보기</Text>
                <Ionicons color={palette.ink} name="chevron-forward" size={15} />
              </View>
            </Pressable>

            <Pressable
              accessibilityLabel="Gold Pass 자세히 보기"
              accessibilityRole="button"
              onPress={() => router.push('/ad-free')}
              style={({ pressed }) => [
                styles.planCard,
                styles.planCardGold,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.planIconGold}>
                <IllustratedIcon size={42} source={illustratedIcons.goldPass} />
              </View>
              <View style={styles.recommendPill}>
                <Text style={styles.recommendText}>추천</Text>
              </View>
              <Text style={styles.planName}>Gold Pass</Text>
              <Text style={styles.planDescription}>방문자·우선 노출·무제한 되돌리기·광고 제거</Text>
              <Text style={styles.planPrice}>{GOLD_PRODUCT.fallbackPriceLabelKo}</Text>
              <View style={styles.planLink}>
                <Text style={styles.planLinkText}>모든 혜택 보기</Text>
                <Ionicons color={palette.ink} name="chevron-forward" size={15} />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={sectionEntering(3)} style={styles.benefitSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitleInline}>Gold 혜택</Text>
            <Text style={styles.sectionHint}>필요할 때만 선택하세요</Text>
          </View>
          <View style={styles.benefitList}>
            {goldBenefits.map((benefit) => (
              <View key={benefit.title} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <IllustratedIcon size={34} source={benefit.illustration} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDetail}>{benefit.detail}</Text>
                </View>
                <Ionicons color="#B1B1B7" name="checkmark-circle" size={19} />
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={sectionEntering(4)} style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareTitle}>한눈에 비교</Text>
            <View style={styles.compareLabels}>
              <Text style={styles.compareLabel}>Free</Text>
              <Text style={styles.compareLabel}>Ad-Free</Text>
              <Text style={[styles.compareLabel, styles.compareLabelGold]}>Gold</Text>
            </View>
          </View>
          {planComparison.map((item, index) => (
            <View
              key={item.label}
              style={[styles.compareRow, index === 0 && styles.compareRowFirst]}
            >
              <Text style={styles.compareFeature}>{item.label}</Text>
              <CompareMark value={item.free} />
              <CompareMark value={item.adFree} />
              <CompareMark gold value={item.gold} />
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={sectionEntering(5)}>
          <Pressable
            accessibilityLabel="구매 복원 및 이용권 관리"
            accessibilityRole="button"
            onPress={() => router.push('/ad-free')}
            style={({ pressed }) => [styles.purchaseManagement, pressed && styles.pressed]}
          >
            <View style={styles.purchaseIcon}>
              <IllustratedIcon size={30} source={illustratedIcons.purchase} />
            </View>
            <View style={styles.purchaseCopy}>
              <Text style={styles.purchaseTitle}>구매 복원 및 이용권 관리</Text>
              <Text style={styles.purchaseText}>기존 구매를 복원하거나 이용 상태를 확인해요</Text>
            </View>
            <Ionicons color={palette.inkMuted} name="chevron-forward" size={18} />
          </Pressable>

          <View style={styles.notice}>
            <IllustratedIcon size={24} source={illustratedIcons.safety} />
            <Text style={styles.noticeText}>
              결제 여부와 관계없이 매치와 채팅 등 핵심 기능은 무료예요. 우선 노출은 필터와 안전
              기준을 통과한 후보 안에서만 적용됩니다.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </Screen>
  );
}

function CompareMark({ value, gold = false }: { value: string; gold?: boolean }) {
  if (value !== 'yes' && value !== 'no') {
    return (
      <View style={styles.compareMark}>
        <Text style={[styles.compareValue, gold && styles.compareValueGold]}>{value}</Text>
      </View>
    );
  }
  const enabled = value === 'yes';
  return (
    <View style={styles.compareMark}>
      <Ionicons
        color={enabled ? (gold ? '#B48600' : palette.ink) : '#C9C9CE'}
        name={enabled ? 'checkmark-circle' : 'remove'}
        size={enabled ? 17 : 16}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { alignSelf: 'center', maxWidth: 620, width: '100%' },
  content: { paddingBottom: 34, paddingHorizontal: 18 },
  currentPlan: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    marginBottom: 12,
    padding: 13,
  },
  currentPlanIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  currentPlanCopy: { flex: 1, marginLeft: 10 },
  currentPlanLabel: { color: palette.inkMuted, fontSize: 11, fontWeight: '700' },
  currentPlanName: { color: palette.ink, fontSize: 14, fontWeight: '900', marginTop: 2 },
  activePill: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  activePillGold: { backgroundColor: '#FFF5CF' },
  activeDot: { backgroundColor: palette.lime, borderRadius: 4, height: 7, width: 7 },
  activeDotGold: { backgroundColor: '#D2A20C' },
  activeText: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  goldHero: {
    borderColor: '#E4CA73',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 21,
    ...elevation.lg,
  },
  goldGlow: {
    backgroundColor: '#E3B830',
    borderRadius: 115,
    height: 220,
    opacity: 0.24,
    position: 'absolute',
    right: -70,
    top: -125,
    width: 220,
  },
  goldTopRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  diamondMark: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  goldPassLabel: { color: '#6E4D00', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  goldMicrocopy: { color: '#765F28', fontSize: 11, marginTop: 2 },
  goldTitle: {
    color: palette.ink,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 36,
    marginTop: 21,
  },
  goldDescription: {
    color: '#6F623D',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 9,
    maxWidth: 310,
  },
  goldHighlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 17 },
  highlightChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderColor: 'rgba(123,88,0,0.16)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  highlightText: { color: '#5F4A14', fontSize: 11, fontWeight: '800' },
  goldAction: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 19,
    minHeight: 48,
  },
  goldActionText: { color: palette.white, fontSize: 13, fontWeight: '900' },
  sectionTitle: {
    ...typography.heading,
    color: palette.ink,
    marginBottom: 11,
    marginTop: 23,
  },
  planRow: { flexDirection: 'row', gap: 9 },
  planCard: {
    backgroundColor: palette.white,
    borderColor: 'transparent',
    borderRadius: 22,
    borderWidth: 1,
    flex: 1,
    minHeight: 213,
    padding: 14,
  },
  planCardGold: { borderColor: '#E5C45C' },
  planIconPink: {
    alignItems: 'center',
    backgroundColor: '#FFE8F0',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  planIconGold: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  recommendPill: {
    backgroundColor: '#FFF0B5',
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 4,
    position: 'absolute',
    right: 11,
    top: 11,
  },
  recommendText: { color: '#765400', fontSize: 11, fontWeight: '900' },
  planName: { color: palette.ink, fontSize: 15, fontWeight: '900', marginTop: 12 },
  planDescription: { color: palette.inkMuted, flex: 1, fontSize: 12, lineHeight: 17, marginTop: 5 },
  planPrice: { color: palette.ink, fontSize: 12, fontWeight: '900', marginTop: 13 },
  planLink: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  planLinkText: { ...typography.caption, color: palette.ink, fontWeight: '800' },
  benefitSection: { marginTop: 25 },
  sectionHeadingRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleInline: { ...typography.heading, color: palette.ink },
  sectionHint: { ...typography.caption, color: palette.inkMuted, fontWeight: '700' },
  benefitList: { backgroundColor: palette.white, borderRadius: radius.lg, paddingHorizontal: 14 },
  benefitItem: {
    alignItems: 'center',
    borderBottomColor: '#ECECEF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 67,
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: '#FFF5D0',
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  benefitCopy: { flex: 1, marginLeft: 11 },
  benefitTitle: { ...typography.label, color: palette.ink, fontWeight: '900' },
  benefitDetail: { ...typography.caption, color: palette.inkMuted, marginTop: 3 },
  compareCard: {
    backgroundColor: palette.white,
    borderRadius: radius.lg,
    marginTop: 14,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  compareHeader: { alignItems: 'flex-end', flexDirection: 'row', paddingBottom: 11 },
  compareTitle: { ...typography.bodyStrong, color: palette.ink, flex: 1, fontWeight: '900' },
  compareLabels: { flexDirection: 'row', width: 153 },
  compareLabel: {
    color: palette.inkMuted,
    flex: 1,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  compareLabelGold: { color: '#9A7000' },
  compareRow: {
    alignItems: 'center',
    borderTopColor: '#ECECEF',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 44,
  },
  compareRowFirst: { borderTopWidth: 0 },
  compareFeature: { color: palette.ink, flex: 1, fontSize: 11, fontWeight: '700' },
  compareMark: { alignItems: 'center', justifyContent: 'center', width: 51 },
  compareValue: { color: palette.inkMuted, fontSize: 11, fontWeight: '800' },
  compareValueGold: { color: '#9A7000', fontWeight: '900' },
  purchaseManagement: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 20,
    flexDirection: 'row',
    marginTop: 14,
    padding: 13,
  },
  purchaseIcon: {
    alignItems: 'center',
    backgroundColor: '#F1F1F3',
    borderRadius: 15,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  purchaseCopy: { flex: 1, marginLeft: 10 },
  purchaseTitle: { color: palette.ink, fontSize: 11, fontWeight: '900' },
  purchaseText: { color: palette.inkMuted, fontSize: 11, marginTop: 3 },
  notice: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 3,
  },
  noticeText: { color: palette.inkMuted, flex: 1, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
