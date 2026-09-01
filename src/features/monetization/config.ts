import { Platform } from 'react-native';

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

function validRevenueCatKey(value: string | undefined) {
  return Boolean(value && /^(goog|appl)_[A-Za-z0-9_-]{8,}$/.test(value));
}

function validAdUnitId(value: string | undefined) {
  return Boolean(value && /^ca-app-pub-\d{16}\/\d{10}$/.test(value));
}

const revenueCatApiKey =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY?.trim()
    : Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY?.trim()
      : undefined;

const rewardedUndoAdUnitId =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNDO_ANDROID_UNIT_ID?.trim()
    : Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNDO_IOS_UNIT_ID?.trim()
      : undefined;

const discoverInterstitialAdUnitId =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_ADMOB_DISCOVER_INTERSTITIAL_ANDROID_UNIT_ID?.trim()
    : Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_DISCOVER_INTERSTITIAL_IOS_UNIT_ID?.trim()
      : undefined;

const browseInterstitialAdUnitId =
  Platform.OS === 'android'
    ? process.env.EXPO_PUBLIC_ADMOB_BROWSE_INTERSTITIAL_ANDROID_UNIT_ID?.trim()
    : Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_ADMOB_BROWSE_INTERSTITIAL_IOS_UNIT_ID?.trim()
      : undefined;

const testMode = enabled(process.env.EXPO_PUBLIC_MONETIZATION_TEST_MODE);

export const monetizationConfig = Object.freeze({
  testMode,
  revenueCatApiKey,
  rewardedUndoAdUnitId,
  discoverInterstitialAdUnitId,
  browseInterstitialAdUnitId,
  purchasesEnabled:
    enabled(process.env.EXPO_PUBLIC_MONETIZATION_ENABLED) && validRevenueCatKey(revenueCatApiKey),
  rewardedAdsEnabled:
    enabled(process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED) &&
    (testMode || validAdUnitId(rewardedUndoAdUnitId)),
  interstitialAdsEnabled:
    enabled(process.env.EXPO_PUBLIC_INTERSTITIAL_ADS_ENABLED) &&
    (testMode || validAdUnitId(discoverInterstitialAdUnitId)),
});

export type MonetizationConfiguration = typeof monetizationConfig;
