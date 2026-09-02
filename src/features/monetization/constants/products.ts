export const AD_FREE_PRODUCT = {
  id: 'wichu_ad_free',
  billingPeriod: 'monthly',
  googlePlayBasePlanId: 'monthly',
  googlePlayIdentifier: 'wichu_ad_free:monthly',
  fallbackPriceKrw: 9_900,
  fallbackPriceLabelKo: '월 ₩9,900',
} as const;

export const GOLD_PRODUCT = {
  id: 'wichu_gold_monthly',
  billingPeriod: 'monthly',
  googlePlayBasePlanId: 'monthly',
  googlePlayIdentifier: 'wichu_gold_monthly:monthly',
  fallbackPriceKrw: 19_900,
  fallbackPriceLabelKo: '월 ₩19,900',
} as const;

export type MonetizationProductId = typeof AD_FREE_PRODUCT.id | typeof GOLD_PRODUCT.id;
