import { describe, expect, it } from 'vitest';

import {
  classifyPurchaseError,
  getActiveMonetizationProductIds,
  getGooglePlayStoreIdentifier,
  getReplacementProductId,
  matchesMonetizationStoreProduct,
  normalizeMonetizationProductId,
} from './purchase-state';

describe('purchase state', () => {
  it('normalizes Google Play base plan product identifiers', () => {
    expect(normalizeMonetizationProductId('wichu_gold_monthly:monthly')).toBe('wichu_gold_monthly');
    expect(normalizeMonetizationProductId('unknown_product')).toBeNull();
  });

  it('matches only the configured monthly Google Play base plan', () => {
    expect(matchesMonetizationStoreProduct('wichu_gold_monthly', 'wichu_gold_monthly')).toBe(true);
    expect(
      matchesMonetizationStoreProduct('wichu_gold_monthly:monthly', 'wichu_gold_monthly'),
    ).toBe(true);
    expect(matchesMonetizationStoreProduct('wichu_gold_monthly:annual', 'wichu_gold_monthly')).toBe(
      false,
    );
  });

  it('uses the base-plan-qualified identifier for Google Play catalog and replacements', () => {
    expect(getGooglePlayStoreIdentifier('wichu_ad_free')).toBe('wichu_ad_free:monthly');
    expect(getGooglePlayStoreIdentifier('wichu_gold_monthly')).toBe('wichu_gold_monthly:monthly');
  });

  it('returns only active WICHU products without duplicates', () => {
    expect(
      getActiveMonetizationProductIds({
        activeSubscriptions: [
          'wichu_gold_monthly:monthly',
          'wichu_gold_monthly',
          'another_subscription',
        ],
      }),
    ).toEqual(['wichu_gold_monthly']);
  });

  it('keeps cancellation, pending, and catalog failures distinct', () => {
    expect(classifyPurchaseError({ code: '1' })).toBe('cancelled');
    expect(classifyPurchaseError({ code: '20' })).toBe('payment_pending');
    expect(classifyPurchaseError({ code: '5' })).toBe('product_not_found');
  });

  it('replaces Ad-Free when upgrading to Gold without creating a second subscription', () => {
    expect(getReplacementProductId('ad_free', 'wichu_gold_monthly')).toBe('wichu_ad_free');
    expect(getReplacementProductId('free', 'wichu_gold_monthly')).toBeUndefined();
    expect(getReplacementProductId('gold', 'wichu_ad_free')).toBeUndefined();
  });
});
