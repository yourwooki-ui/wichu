import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  titleKey: string;
  detailKey: string;
}[] = [
  {
    illustration: illustratedIcons.connections,
    titleKey: 'shop.benefit.visitors.title',
    detailKey: 'shop.benefit.visitors.detail',
  },
  {
    illustration: illustratedIcons.discoveryVisible,
    titleKey: 'shop.benefit.exposure.title',
    detailKey: 'shop.benefit.exposure.detail',
  },
  {
    illustration: illustratedIcons.goldPremium,
    titleKey: 'shop.benefit.profile.title',
    detailKey: 'shop.benefit.profile.detail',
  },
  {
    illustration: illustratedIcons.adFree,
    titleKey: 'shop.benefit.adFree.title',
    detailKey: 'shop.benefit.adFree.detail',
  },
  {
    illustration: illustratedIcons.rewind,
    titleKey: 'shop.benefit.rewind.title',
    detailKey: 'shop.benefit.rewind.detail',
  },
  {
    illustration: illustratedIcons.profilePhotos,
    titleKey: 'shop.benefit.chatPhotos.title',
    detailKey: 'shop.benefit.chatPhotos.detail',
  },
];

const planComparison = [
  { labelKey: 'shop.comparison.core', free: 'yes', adFree: 'yes', gold: 'yes' },
  { labelKey: 'shop.comparison.autoAds', free: 'no', adFree: 'yes', gold: 'yes' },
  { labelKey: 'shop.comparison.visitors', free: 'no', adFree: 'no', gold: 'yes' },
  { labelKey: 'shop.comparison.exposure', free: 'no', adFree: 'no', gold: 'yes' },
  { labelKey: 'shop.comparison.chatPhotos', free: 'no', adFree: 'no', gold: 'maxPhotos' },
  { labelKey: 'shop.comparison.rewind', free: 'adOnce', adFree: 'adOnce', gold: 'unlimited' },
];

export function ShopScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const entitlement = usePassEntitlement();
  const tier = entitlement.data?.tier;
  const comparisonValue = (value: string) =>
    ['adOnce', 'maxPhotos', 'unlimited'].includes(value) ? t(`shop.comparison.${value}`) : value;
  const tierForVisual = tier ?? 'free';
  const tierLabel = entitlement.isPending
    ? t('shop.checking')
    : entitlement.isError
      ? t('shop.checkNeeded')
      : tier === 'gold'
        ? 'Gold Pass'
        : tier === 'ad_free'
          ? 'Ad-Free'
          : 'Free';

  useEffect(() => {
    productAnalyticsService.track(
      'purchase_viewed',
      { surface: 'shop', tier: tier ?? 'unknown' },
      '/shop',
    );
  }, [tier]);

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <AppTabHeader
        actionAccessibilityLabel={t('shop.headerAction')}
        actionIcon={illustratedIcons.purchase}
        eyebrow={t('shop.eyebrow')}
        onAction={() => router.push('/ad-free')}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={sectionEntering(0)} style={styles.currentPlan}>
          <View style={styles.currentPlanIcon}>
            <IllustratedIcon size={38} source={getPassIllustration(tierForVisual)} />
          </View>
          <View style={styles.currentPlanCopy}>
            <Text style={styles.currentPlanLabel}>{t('shop.currentPlan')}</Text>
            <Text style={styles.currentPlanName}>{tierLabel}</Text>
          </View>
          {entitlement.isError ? (
            <Pressable
              accessibilityLabel={t('shop.retry')}
              accessibilityRole="button"
              onPress={() => entitlement.refetch()}
              style={({ pressed }) => [styles.retryPill, pressed && styles.pressed]}
            >
              <Text style={styles.retryPillText}>{t('shop.retry')}</Text>
            </Pressable>
          ) : (
            <View style={[styles.activePill, tier === 'gold' && styles.activePillGold]}>
              <View style={[styles.activeDot, tier === 'gold' && styles.activeDotGold]} />
              <Text style={styles.activeText}>
                {entitlement.isPending ? t('shop.checking') : t('shop.inUse')}
              </Text>
            </View>
          )}
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
                <Text style={styles.goldMicrocopy}>{t('shop.goldMicrocopy')}</Text>
              </View>
            </View>
            <Text style={styles.goldTitle}>{t('shop.goldTitle')}</Text>
            <Text style={styles.goldDescription}>{t('shop.goldDescription')}</Text>
            <View style={styles.goldHighlights}>
              {goldBenefits.slice(0, 3).map((benefit) => (
                <View key={benefit.titleKey} style={styles.highlightChip}>
                  <IllustratedIcon size={20} source={benefit.illustration} />
                  <Text style={styles.highlightText}>{t(benefit.titleKey)}</Text>
                </View>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/ad-free')}
              style={({ pressed }) => [styles.goldAction, pressed && styles.pressed]}
            >
              <Text style={styles.goldActionText}>
                {tier === 'gold' ? t('shop.goldManage') : t('shop.benefitsPrice')}
              </Text>
              <Ionicons color={palette.white} name="arrow-forward" size={17} />
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={sectionEntering(2)}>
          <Text style={styles.sectionTitle}>{t('shop.choosePlan')}</Text>
          <View style={styles.planRow}>
            <Pressable
              accessibilityLabel={t('shop.adFreeA11y')}
              accessibilityRole="button"
              onPress={() => router.push('/ad-free?product=ad-free')}
              style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
            >
              <View style={styles.planIconPink}>
                <IllustratedIcon size={42} source={illustratedIcons.adFree} />
              </View>
              <Text style={styles.planName}>Ad-Free</Text>
              <Text style={styles.planDescription}>{t('shop.adFreeDescription')}</Text>
              <Text style={styles.planPrice}>{AD_FREE_PRODUCT.fallbackPriceLabelKo}</Text>
              <View style={styles.planLink}>
                <Text style={styles.planLinkText}>{t('shop.details')}</Text>
                <Ionicons color={palette.ink} name="chevron-forward" size={15} />
              </View>
            </Pressable>

            <Pressable
              accessibilityLabel={t('shop.goldA11y')}
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
                <Text style={styles.recommendText}>{t('shop.recommended')}</Text>
              </View>
              <Text style={styles.planName}>Gold Pass</Text>
              <Text style={styles.planDescription}>{t('shop.goldPlanDescription')}</Text>
              <Text style={styles.planPrice}>{GOLD_PRODUCT.fallbackPriceLabelKo}</Text>
              <View style={styles.planLink}>
                <Text style={styles.planLinkText}>{t('shop.allBenefits')}</Text>
                <Ionicons color={palette.ink} name="chevron-forward" size={15} />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={sectionEntering(3)} style={styles.benefitSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitleInline}>{t('shop.goldBenefits')}</Text>
            <Text style={styles.sectionHint}>{t('shop.hint')}</Text>
          </View>
          <View style={styles.benefitList}>
            {goldBenefits.map((benefit) => (
              <View key={benefit.titleKey} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <IllustratedIcon size={34} source={benefit.illustration} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{t(benefit.titleKey)}</Text>
                  <Text style={styles.benefitDetail}>{t(benefit.detailKey)}</Text>
                </View>
                <Ionicons color="#B1B1B7" name="checkmark-circle" size={19} />
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={sectionEntering(4)} style={styles.compareCard}>
          <View style={styles.compareHeader}>
            <Text style={styles.compareTitle}>{t('shop.compare')}</Text>
            <View style={styles.compareLabels}>
              <Text style={styles.compareLabel}>Free</Text>
              <Text style={styles.compareLabel}>Ad-Free</Text>
              <Text style={[styles.compareLabel, styles.compareLabelGold]}>Gold</Text>
            </View>
          </View>
          {planComparison.map((item, index) => (
            <View
              key={item.labelKey}
              style={[styles.compareRow, index === 0 && styles.compareRowFirst]}
            >
              <Text style={styles.compareFeature}>{t(item.labelKey)}</Text>
              <CompareMark value={comparisonValue(item.free)} />
              <CompareMark value={comparisonValue(item.adFree)} />
              <CompareMark gold value={comparisonValue(item.gold)} />
            </View>
          ))}
        </Animated.View>

        <Animated.View entering={sectionEntering(5)}>
          <Pressable
            accessibilityLabel={t('shop.headerAction')}
            accessibilityRole="button"
            onPress={() => router.push('/ad-free')}
            style={({ pressed }) => [styles.purchaseManagement, pressed && styles.pressed]}
          >
            <View style={styles.purchaseIcon}>
              <IllustratedIcon size={30} source={illustratedIcons.purchase} />
            </View>
            <View style={styles.purchaseCopy}>
              <Text style={styles.purchaseTitle}>{t('shop.purchaseTitle')}</Text>
              <Text style={styles.purchaseText}>{t('shop.purchaseBody')}</Text>
            </View>
            <Ionicons color={palette.inkMuted} name="chevron-forward" size={18} />
          </Pressable>

          <View style={styles.notice}>
            <IllustratedIcon size={24} source={illustratedIcons.safety} />
            <Text style={styles.noticeText}>{t('shop.notice')}</Text>
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
  retryPill: {
    borderColor: '#D7A1AD',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  retryPillText: { color: '#8B2940', fontSize: 11, fontWeight: '900' },
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
