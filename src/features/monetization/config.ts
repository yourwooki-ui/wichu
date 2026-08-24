import { Platform } from 'react-native';

function enabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
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

export const monetizationConfig = Object.freeze({
  revenueCatApiKey,
  rewardedUndoAdUnitId,
  discoverInterstitialAdUnitId,
  purchasesEnabled:
    enabled(process.env.EXPO_PUBLIC_MONETIZATION_ENABLED) && Boolean(revenueCatApiKey),
  rewardedAdsEnabled:
    enabled(process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED) && Boolean(rewardedUndoAdUnitId),
  interstitialAdsEnabled:
    enabled(process.env.EXPO_PUBLIC_INTERSTITIAL_ADS_ENABLED) &&
    Boolean(discoverInterstitialAdUnitId),
});

export type MonetizationConfiguration = typeof monetizationConfig;
