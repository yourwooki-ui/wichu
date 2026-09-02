import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/PrimaryButton';
import { IllustratedIcon } from '@/components/IllustratedIcon';
import { illustratedIcons } from '@/constants/illustrated-icons';
import { MONETIZATION_ENABLED } from '@/constants/features';
import { palette, pressFeedback, radius, touchSlop, typography } from '@/constants/theme';
import { AD_FREE_PRODUCT, GOLD_PRODUCT } from '@/features/monetization/constants/products';
import { usePassEntitlement } from '@/features/monetization/hooks/use-pass-entitlement';
import { purchaseService } from '@/features/monetization/services/purchase-service';
import type { PurchaseUnavailableReason } from '@/features/monetization/services/types';
import { getReplacementProductId } from '@/features/monetization/utils/purchase-state';
import { useAuthSession } from '@/hooks/use-auth-session';
import { reportOperationalError } from '@/services/operational-error-service';
import { productAnalyticsService } from '@/services/product-analytics-service';

const GOLD_BENEFITS = [
  { labelKey: 'shop.benefit.profile.title', icon: illustratedIcons.goldPremium },
  { labelKey: 'shop.benefit.visitors.title', icon: illustratedIcons.connections },
  { labelKey: 'shop.benefit.exposure.title', icon: illustratedIcons.discoveryVisible },
  { labelKey: 'shop.benefit.adFree.title', icon: illustratedIcons.adFree },
  { labelKey: 'shop.benefit.rewind.title', icon: illustratedIcons.rewind },
] as const;

const AD_FREE_BENEFITS = [
  { labelKey: 'shop.benefit.adFree.title', icon: illustratedIcons.adFree },
] as const;

function purchaseFailureCopy(reason: PurchaseUnavailableReason, t: TFunction) {
  switch (reason) {
    case 'network':
      return t('shop.failure.network');
    case 'not_allowed':
      return t('shop.failure.notAllowed');
    case 'payment_pending':
      return t('shop.failure.pending');
    case 'account_conflict':
      return t('shop.failure.conflict');
    case 'product_not_found':
      return t('shop.failure.missing');
    case 'not_configured':
    case 'sdk_unavailable':
      return t('shop.failure.sdk');
    case 'store_unavailable':
      return t('shop.failure.store');
    default:
      return t('shop.failure.unknown');
  }
}

/** 결제 연동 전에는 직접 접근도 막는다 (딥링크·뒤로가기 포함). */
export default function PassDetailRoute() {
  if (!MONETIZATION_ENABLED) return <Redirect href="/(tabs)/discover" />;
  return <PassDetailScreen />;
}

function PassDetailScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { product } = useLocalSearchParams<{ product?: string }>();
  const { session } = useAuthSession();
  const entitlement = usePassEntitlement();
  const adFreeOnly = product === 'ad-free';
  const [purchasePending, setPurchasePending] = useState(false);
  const [managementUrl, setManagementUrl] = useState<string | null>(null);
  const selectedProduct = adFreeOnly ? AD_FREE_PRODUCT : GOLD_PRODUCT;

  useEffect(() => {
    productAnalyticsService.track(
      'purchase_viewed',
      { product: adFreeOnly ? 'ad_free' : 'gold', surface: 'detail' },
      '/ad-free',
    );
  }, [adFreeOnly]);
  const alreadyIncluded =
    entitlement.data?.tier === 'gold' || (adFreeOnly && entitlement.data?.tier === 'ad_free');
  const replacingProductId = getReplacementProductId(entitlement.data?.tier, selectedProduct.id);
  const products = useQuery({
    enabled: Boolean(session?.user.id),
    queryFn: () => purchaseService.listProducts(session!.user.id),
    queryKey: ['store-products', session?.user.id],
    retry: 2,
    staleTime: 5 * 60_000,
  });
  const storeProduct = products.data?.products.find((item) => item.id === selectedProduct.id);
  const productUnavailableReason = storeProduct
    ? null
    : (products.data?.unavailableReason ?? 'product_not_found');

  useEffect(() => {
    const error = products.error ?? entitlement.error;
    if (error) reportOperationalError('purchase_state_query', error, '/ad-free');
  }, [entitlement.error, products.error]);

  const waitForServerEntitlement = async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const refreshed = await entitlement.refetch();
      const tier = refreshed.data?.tier;
      if (tier === 'gold' || (adFreeOnly && tier === 'ad_free')) return true;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    return false;
  };

  const handlePurchase = async () => {
    if (!session?.user.id || !storeProduct || purchasePending) return;
    if (!entitlement.isSuccess) {
      Alert.alert(t('shop.pass.stateFirstTitle'), t('shop.pass.stateFirstBody'));
      return;
    }
    setPurchasePending(true);
    productAnalyticsService.track(
      'purchase_started',
      { product: selectedProduct.id, replacing_product: replacingProductId ?? 'none' },
      '/ad-free',
    );
    try {
      const result = await purchaseService.purchase(
        session.user.id,
        selectedProduct.id,
        replacingProductId,
      );
      if (result.status === 'cancelled') {
        productAnalyticsService.track(
          'purchase_cancelled',
          { product: selectedProduct.id },
          '/ad-free',
        );
        return;
      }
      if (result.status === 'unavailable') {
        productAnalyticsService.track(
          'purchase_failed',
          { product: selectedProduct.id, reason: result.reason },
          '/ad-free',
        );
        Alert.alert(
          result.reason === 'payment_pending'
            ? t('shop.pass.pendingTitle')
            : t('shop.pass.purchaseFailedTitle'),
          purchaseFailureCopy(result.reason, t),
        );
        return;
      }
      setManagementUrl(result.managementUrl);
      const storeConfirmed = result.activeProductIds.includes(selectedProduct.id);
      const confirmed = await waitForServerEntitlement();
      productAnalyticsService.track(
        'purchase_completed',
        {
          product: selectedProduct.id,
          server_confirmed: confirmed,
          store_confirmed: storeConfirmed,
        },
        '/ad-free',
      );
      Alert.alert(
        confirmed ? t('shop.pass.activeTitle') : t('shop.pass.verifyingTitle'),
        confirmed
          ? t('shop.pass.activeBody')
          : storeConfirmed
            ? t('shop.pass.paidAwaitBody')
            : t('shop.pass.storeAwaitBody'),
      );
    } catch (error) {
      reportOperationalError('purchase_action', error, '/ad-free');
      productAnalyticsService.track(
        'purchase_failed',
        { product: selectedProduct.id, reason: 'unexpected_error' },
        '/ad-free',
      );
      Alert.alert(t('shop.pass.purchaseFailedTitle'), purchaseFailureCopy('unknown', t));
    } finally {
      setPurchasePending(false);
    }
  };

  const handleRestore = async () => {
    if (!session?.user.id || purchasePending) return;
    setPurchasePending(true);
    try {
      const result = await purchaseService.restore(session.user.id);
      if (result.status === 'cancelled') return;
      if (result.status === 'unavailable') {
        productAnalyticsService.track(
          'purchase_failed',
          { product: 'restore', reason: result.reason },
          '/ad-free',
        );
        Alert.alert(t('shop.pass.restoreFailedTitle'), purchaseFailureCopy(result.reason, t));
        return;
      }
      setManagementUrl(result.managementUrl);
      if (result.activeProductIds.length === 0) {
        Alert.alert(t('shop.pass.noRestoreTitle'), t('shop.pass.noRestoreBody'));
        return;
      }
      const confirmed = await waitForServerEntitlement();
      productAnalyticsService.track(
        'purchase_restored',
        { server_confirmed: confirmed },
        '/ad-free',
      );
      Alert.alert(
        confirmed ? t('shop.pass.restoredTitle') : t('shop.pass.restoreVerifyingTitle'),
        confirmed ? t('shop.pass.restoredBody') : t('shop.pass.serverAwaitBody'),
      );
    } catch (error) {
      reportOperationalError('purchase_restore', error, '/ad-free');
      productAnalyticsService.track(
        'purchase_failed',
        { product: 'restore', reason: 'unexpected_error' },
        '/ad-free',
      );
      Alert.alert(t('shop.pass.restoreFailedTitle'), purchaseFailureCopy('unknown', t));
    } finally {
      setPurchasePending(false);
    }
  };

  const openSubscriptionManagement = async () => {
    let url = managementUrl;
    if (!url && session?.user.id) {
      const state = await purchaseService.getCustomerState(session.user.id);
      if (state.status === 'purchased') {
        url = state.managementUrl;
        setManagementUrl(state.managementUrl);
      }
    }
    url ??=
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions?package=app.wichu.mobile';
    void Linking.openURL(url).catch(() => {
      Alert.alert(t('shop.pass.manageFailedTitle'), t('shop.pass.retryBody'));
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t('shop.pass.back')}
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <Ionicons color={palette.ink} name="chevron-back" size={22} />
        </Pressable>
        <Text style={styles.headerTitle}>{adFreeOnly ? 'Ad-Free' : 'Gold Pass'}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.mark}>
          <IllustratedIcon
            size={78}
            source={adFreeOnly ? illustratedIcons.adFree : illustratedIcons.goldPass}
          />
        </View>
        <Text style={styles.eyebrow}>{adFreeOnly ? 'WICHU AD-FREE' : 'WICHU GOLD PASS'}</Text>
        <Text style={styles.title}>
          {adFreeOnly ? t('shop.pass.adFreeTitle') : t('shop.pass.goldTitle')}
        </Text>
        <Text style={styles.description}>
          {adFreeOnly ? t('shop.pass.adFreeBody') : t('shop.pass.goldBody')}
        </Text>

        <View style={styles.benefits}>
          {(adFreeOnly ? AD_FREE_BENEFITS : GOLD_BENEFITS).map((benefit) => (
            <View key={benefit.labelKey} style={styles.benefitRow}>
              <IllustratedIcon size={36} source={benefit.icon} />
              <Text style={styles.benefitText}>{t(benefit.labelKey)}</Text>
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
          <Text style={styles.priceLabel}>{t('shop.pass.monthly')}</Text>
          <Text style={styles.price}>
            {storeProduct?.priceLabel ?? t('shopPricing.unavailable')}
          </Text>
          <Text style={styles.priceHint}>
            {adFreeOnly ? t('shop.pass.renewAdFree') : t('shop.pass.renewGold')}
          </Text>
        </View>

        {!products.isPending && !storeProduct ? (
          <View accessibilityRole="alert" style={styles.storeStatus}>
            <Ionicons color="#9A6B00" name="information-circle" size={20} />
            <Text style={styles.storeStatusText}>
              {purchaseFailureCopy(productUnavailableReason ?? 'unknown', t)}
            </Text>
          </View>
        ) : null}

        {entitlement.isError ? (
          <View accessibilityRole="alert" style={styles.entitlementStatus}>
            <Ionicons color="#9A243A" name="alert-circle" size={20} />
            <View style={styles.entitlementStatusCopy}>
              <Text style={styles.entitlementStatusTitle}>{t('shop.pass.statusFailed')}</Text>
              <Text style={styles.entitlementStatusText}>{t('shop.pass.statusHold')}</Text>
            </View>
            <Pressable
              accessibilityLabel={t('shop.retry')}
              accessibilityRole="button"
              onPress={() => entitlement.refetch()}
              style={({ pressed }) => [styles.entitlementRetry, pressed && pressFeedback.control]}
            >
              <Text style={styles.entitlementRetryText}>{t('shop.retry')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.purchaseSlot}>
          <PrimaryButton
            disabled={!alreadyIncluded && (products.isPending || !entitlement.isSuccess)}
            label={
              alreadyIncluded
                ? t('shop.pass.manage')
                : entitlement.isPending
                  ? t('shop.pass.checking')
                  : entitlement.isError
                    ? t('shop.pass.checkRequired')
                    : storeProduct
                      ? replacingProductId
                        ? t('shop.pass.upgrade')
                        : t('shop.pass.subscribe')
                      : products.isPending
                        ? t('shop.pass.productChecking')
                        : t('shop.pass.productRetry')
            }
            loading={purchasePending || products.isFetching}
            onPress={
              alreadyIncluded
                ? () => void openSubscriptionManagement()
                : storeProduct
                  ? handlePurchase
                  : () => void products.refetch()
            }
            variant={alreadyIncluded ? 'secondary' : 'primary'}
          />
        </View>
        <Pressable
          accessibilityLabel={t('shop.pass.restore')}
          accessibilityRole="button"
          accessibilityState={{ busy: purchasePending, disabled: purchasePending }}
          disabled={purchasePending}
          hitSlop={touchSlop.link}
          onPress={handleRestore}
          style={({ pressed }) => [styles.restore, pressed && pressFeedback.control]}
        >
          <IllustratedIcon size={24} source={illustratedIcons.purchase} />
          <Text style={styles.restoreText}>{t('shop.pass.restore')}</Text>
        </Pressable>
        <Text style={styles.legal}>{t('shop.pass.billingNotice')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#F8F8FA', flex: 1 },
  scroll: { flex: 1, minHeight: 0 },
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
  storeStatus: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: '#FFF8E6',
    borderColor: '#F3D99B',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  storeStatusText: {
    ...typography.caption,
    color: '#725000',
    flex: 1,
    lineHeight: 18,
  },
  entitlementStatus: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: '#FFF1F4',
    borderColor: '#F4C4CE',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
    padding: 12,
  },
  entitlementStatusCopy: { flex: 1 },
  entitlementStatusTitle: { color: '#76192D', fontSize: 12, fontWeight: '900' },
  entitlementStatusText: { color: '#8D4253', fontSize: 11, lineHeight: 16, marginTop: 3 },
  entitlementRetry: {
    alignItems: 'center',
    borderColor: '#D88A9B',
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 11,
  },
  entitlementRetryText: { color: '#76192D', fontSize: 11, fontWeight: '900' },
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
