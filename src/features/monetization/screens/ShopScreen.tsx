import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandWordmark } from '@/components/BrandWordmark';
import { Screen } from '@/components/Screen';
import { useAppTheme } from '@/components/ThemeProvider';
import { palette, radius } from '@/constants/theme';
import { AD_FREE_PRODUCT } from '@/features/monetization/constants/products';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';

const goldBenefits: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  { icon: 'eye-outline', title: '방문자 확인', detail: '나를 궁금해한 사람을 확인해요' },
  { icon: 'sparkles-outline', title: '우선 노출', detail: '조건이 맞는 사용자에게 먼저 보여요' },
  {
    icon: 'diamond-outline',
    title: '골드 프로필',
    detail: '테두리와 다이아몬드로 존재감을 높여요',
  },
  { icon: 'remove-circle-outline', title: '광고 제거', detail: '흐름이 끊기지 않게 이용해요' },
];

const planComparison = [
  { label: '핵심 기능', free: true, adFree: true, gold: true },
  { label: '광고 제거', free: false, adFree: true, gold: true },
  { label: '방문자 확인', free: false, adFree: false, gold: true },
  { label: '우선 노출', free: false, adFree: false, gold: true },
];

export function ShopScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const entitlement = usePassEntitlement();
  const tier = entitlement.data?.tier ?? 'free';
  const tierLabel = tier === 'gold' ? 'Gold Pass' : tier === 'ad_free' ? 'Ad-Free' : 'Free';

  return (
    <Screen edges={['top', 'left', 'right']} padded={false} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <BrandWordmark color={theme.colors.text} size={23} />
          <Text style={[styles.eyebrow, { color: theme.colors.textMuted }]}>상점</Text>
        </View>
        <Pressable
          accessibilityLabel="구매 복원 및 이용권 관리"
          onPress={() => router.push('/ad-free')}
          style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}
        >
          <Ionicons color={palette.ink} name="receipt-outline" size={18} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.currentPlan}>
          <View style={styles.currentPlanIcon}>
            <Ionicons
              color={tier === 'gold' ? '#9B7000' : palette.pink}
              name={tier === 'gold' ? 'diamond' : 'person-outline'}
              size={18}
            />
          </View>
          <View style={styles.currentPlanCopy}>
            <Text style={styles.currentPlanLabel}>현재 이용권</Text>
            <Text style={styles.currentPlanName}>{tierLabel}</Text>
          </View>
          <View style={[styles.activePill, tier === 'gold' && styles.activePillGold]}>
            <View style={[styles.activeDot, tier === 'gold' && styles.activeDotGold]} />
            <Text style={styles.activeText}>이용 중</Text>
          </View>
        </View>

        <LinearGradient colors={['#302409', '#111006']} style={styles.goldHero}>
          <View style={styles.goldGlow} />
          <View style={styles.goldTopRow}>
            <View style={styles.diamondMark}>
              <Ionicons color="#4B3600" name="diamond" size={20} />
            </View>
            <View>
              <Text style={styles.goldPassLabel}>WICHU GOLD PASS</Text>
              <Text style={styles.goldMicrocopy}>발견 가능성을 한 단계 더</Text>
            </View>
          </View>
          <Text style={styles.goldTitle}>더 잘 보이고,{`\n`}먼저 연결되게.</Text>
          <Text style={styles.goldDescription}>
            방문자를 확인하고, 프로필의 존재감을 높이고, 광고 없이 집중해요.
          </Text>
          <View style={styles.goldHighlights}>
            {goldBenefits.slice(0, 3).map((benefit) => (
              <View key={benefit.title} style={styles.highlightChip}>
                <Ionicons color="#FFD35A" name={benefit.icon} size={14} />
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
            <Ionicons color="#3D2B00" name="arrow-forward" size={17} />
          </Pressable>
        </LinearGradient>

        <Text style={styles.sectionTitle}>나에게 맞는 이용권</Text>
        <View style={styles.planRow}>
          <Pressable
            onPress={() => router.push('/ad-free?product=ad-free')}
            style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
          >
            <View style={styles.planIconPink}>
              <Ionicons color={palette.pink} name="remove-circle-outline" size={20} />
            </View>
            <Text style={styles.planName}>Ad-Free</Text>
            <Text style={styles.planDescription}>다른 혜택 없이 광고만 깔끔하게 제거</Text>
            <Text style={styles.planPrice}>{AD_FREE_PRODUCT.fallbackPriceLabelKo}</Text>
            <View style={styles.planLink}>
              <Text style={styles.planLinkText}>자세히 보기</Text>
              <Ionicons color={palette.ink} name="chevron-forward" size={15} />
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/ad-free')}
            style={({ pressed }) => [
              styles.planCard,
              styles.planCardGold,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.planIconGold}>
              <Ionicons color="#6A4A00" name="diamond-outline" size={20} />
            </View>
            <View style={styles.recommendPill}>
              <Text style={styles.recommendText}>추천</Text>
            </View>
            <Text style={styles.planName}>Gold Pass</Text>
            <Text style={styles.planDescription}>방문자·우선 노출·광고 제거를 한 번에</Text>
            <Text style={styles.planPrice}>스토어에서 가격 확인</Text>
            <View style={styles.planLink}>
              <Text style={styles.planLinkText}>모든 혜택 보기</Text>
              <Ionicons color={palette.ink} name="chevron-forward" size={15} />
            </View>
          </Pressable>
        </View>

        <View style={styles.benefitSection}>
          <View style={styles.sectionHeadingRow}>
            <Text style={styles.sectionTitleInline}>Gold 혜택</Text>
            <Text style={styles.sectionHint}>필요할 때만 선택하세요</Text>
          </View>
          <View style={styles.benefitList}>
            {goldBenefits.map((benefit) => (
              <View key={benefit.title} style={styles.benefitItem}>
                <View style={styles.benefitIcon}>
                  <Ionicons color="#8A6200" name={benefit.icon} size={19} />
                </View>
                <View style={styles.benefitCopy}>
                  <Text style={styles.benefitTitle}>{benefit.title}</Text>
                  <Text style={styles.benefitDetail}>{benefit.detail}</Text>
                </View>
                <Ionicons color="#B1B1B7" name="checkmark-circle" size={19} />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.compareCard}>
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
              <CompareMark enabled={item.free} />
              <CompareMark enabled={item.adFree} />
              <CompareMark enabled={item.gold} gold />
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => router.push('/ad-free')}
          style={({ pressed }) => [styles.purchaseManagement, pressed && styles.pressed]}
        >
          <View style={styles.purchaseIcon}>
            <Ionicons color={palette.ink} name="refresh-outline" size={19} />
          </View>
          <View style={styles.purchaseCopy}>
            <Text style={styles.purchaseTitle}>구매 복원 및 이용권 관리</Text>
            <Text style={styles.purchaseText}>기존 구매를 복원하거나 이용 상태를 확인해요</Text>
          </View>
          <Ionicons color={palette.inkMuted} name="chevron-forward" size={18} />
        </Pressable>

        <View style={styles.notice}>
          <Ionicons color={palette.inkMuted} name="shield-checkmark-outline" size={18} />
          <Text style={styles.noticeText}>
            결제 여부와 관계없이 매치와 채팅 등 핵심 기능은 무료예요. 우선 노출은 필터와 안전 기준을
            통과한 후보 안에서만 적용됩니다.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function CompareMark({ enabled, gold = false }: { enabled: boolean; gold?: boolean }) {
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 76,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 2.1, lineHeight: 12, marginTop: 2 },
  manageButton: {
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
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
  currentPlanLabel: { color: palette.inkMuted, fontSize: 9, fontWeight: '700' },
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
  activeText: { color: palette.ink, fontSize: 8, fontWeight: '900' },
  goldHero: {
    borderRadius: 27,
    overflow: 'hidden',
    padding: 21,
    ...Platform.select({ web: { boxShadow: '0 12px 28px rgba(55,39,0,0.18)' } }),
  },
  goldGlow: {
    backgroundColor: '#D49E17',
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
    backgroundColor: '#FFD35A',
    borderRadius: 19,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  goldPassLabel: { color: '#FFE59A', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  goldMicrocopy: { color: 'rgba(255,255,255,0.52)', fontSize: 8, marginTop: 2 },
  goldTitle: {
    color: palette.white,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 36,
    marginTop: 21,
  },
  goldDescription: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
    maxWidth: 310,
  },
  goldHighlights: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 17 },
  highlightChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,211,90,0.22)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  highlightText: { color: '#F7EDCF', fontSize: 8, fontWeight: '800' },
  goldAction: {
    alignItems: 'center',
    backgroundColor: '#FFD35A',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    marginTop: 19,
    minHeight: 48,
  },
  goldActionText: { color: '#3D2B00', fontSize: 11, fontWeight: '900' },
  sectionTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
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
    backgroundColor: '#FFF0B5',
    borderRadius: 16,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
  recommendText: { color: '#765400', fontSize: 7, fontWeight: '900' },
  planName: { color: palette.ink, fontSize: 15, fontWeight: '900', marginTop: 12 },
  planDescription: { color: palette.inkMuted, flex: 1, fontSize: 9, lineHeight: 14, marginTop: 5 },
  planPrice: { color: palette.ink, fontSize: 10, fontWeight: '900', marginTop: 13 },
  planLink: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  planLinkText: { color: palette.ink, fontSize: 9, fontWeight: '800' },
  benefitSection: { marginTop: 25 },
  sectionHeadingRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleInline: { color: palette.ink, fontSize: 18, fontWeight: '900' },
  sectionHint: { color: palette.inkMuted, fontSize: 8, fontWeight: '700' },
  benefitList: { backgroundColor: palette.white, borderRadius: 23, paddingHorizontal: 14 },
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
  benefitTitle: { color: palette.ink, fontSize: 12, fontWeight: '900' },
  benefitDetail: { color: palette.inkMuted, fontSize: 8, marginTop: 3 },
  compareCard: {
    backgroundColor: palette.white,
    borderRadius: 23,
    marginTop: 14,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  compareHeader: { alignItems: 'flex-end', flexDirection: 'row', paddingBottom: 11 },
  compareTitle: { color: palette.ink, flex: 1, fontSize: 15, fontWeight: '900' },
  compareLabels: { flexDirection: 'row', width: 153 },
  compareLabel: {
    color: palette.inkMuted,
    flex: 1,
    fontSize: 7,
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
  compareFeature: { color: palette.ink, flex: 1, fontSize: 10, fontWeight: '700' },
  compareMark: { alignItems: 'center', justifyContent: 'center', width: 51 },
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
  purchaseText: { color: palette.inkMuted, fontSize: 8, marginTop: 3 },
  notice: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 3,
  },
  noticeText: { color: palette.inkMuted, flex: 1, fontSize: 8, lineHeight: 13 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
