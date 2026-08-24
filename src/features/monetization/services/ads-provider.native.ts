import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AdEventType,
  AdsConsent,
  AgeRestrictedTreatment,
  InterstitialAd,
  MaxAdContentRating,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
  default as mobileAds,
} from 'react-native-google-mobile-ads';

import { monetizationConfig } from '@/features/monetization/config';
import type { AdsProvider, RewardedAdResult } from '@/features/monetization/services/types';
import {
  recordInterstitialShown,
  registerDiscoverAction,
  type InterstitialFrequencyState,
} from '@/features/monetization/utils/ad-frequency-policy';

const FREQUENCY_STATE_KEY = 'wichu:ads:discover-frequency:v1';
const LOAD_TIMEOUT_MS = 20_000;
let initialization: Promise<boolean> | null = null;
let interstitialInFlight = false;

async function initializeMobileAds() {
  if (!monetizationConfig.rewardedAdsEnabled && !monetizationConfig.interstitialAdsEnabled) {
    return false;
  }

  try {
    const consent = await AdsConsent.gatherConsent({
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : undefined,
    });
    if (!consent.canRequestAds) return false;

    await mobileAds().setRequestConfiguration({
      ageRestrictedTreatment: AgeRestrictedTreatment.UNSPECIFIED,
      maxAdContentRating: MaxAdContentRating.T,
      testDeviceIdentifiers: __DEV__ ? ['EMULATOR'] : [],
    });
    await mobileAds().initialize();
    return true;
  } catch {
    return false;
  }
}

async function readFrequencyState(): Promise<InterstitialFrequencyState | null> {
  try {
    const stored = await AsyncStorage.getItem(FREQUENCY_STATE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<InterstitialFrequencyState>;
    if (
      typeof parsed.actionsSinceLastAd !== 'number' ||
      typeof parsed.dailyCount !== 'number' ||
      typeof parsed.dayKey !== 'string' ||
      (parsed.lastShownAt !== null && typeof parsed.lastShownAt !== 'number')
    ) {
      return null;
    }
    return parsed as InterstitialFrequencyState;
  } catch {
    return null;
  }
}

async function saveFrequencyState(state: InterstitialFrequencyState) {
  await AsyncStorage.setItem(FREQUENCY_STATE_KEY, JSON.stringify(state)).catch(() => undefined);
}

async function showLoadedInterstitial(adUnitId: string) {
  const ad = InterstitialAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ad.removeAllListeners();
      resolve(shown);
    };
    const timeout = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    ad.addAdEventListener(AdEventType.LOADED, () => {
      void ad.show().catch(() => finish(false));
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => finish(true));
    ad.addAdEventListener(AdEventType.ERROR, () => finish(false));
    ad.load();
  });
}

async function showRewarded(
  adUnitId: string,
  placement: string,
  userId: string,
): Promise<RewardedAdResult> {
  const ad = RewardedAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
    serverSideVerificationOptions: { customData: placement, userId },
  });

  return new Promise<RewardedAdResult>((resolve) => {
    let earned = false;
    let settled = false;
    const finish = (result: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ad.removeAllListeners();
      resolve(result);
    };
    const timeout = setTimeout(() => finish('unavailable'), LOAD_TIMEOUT_MS);
    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      clearTimeout(timeout);
      void ad.show().catch(() => finish('unavailable'));
    });
    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned ? 'rewarded' : 'dismissed'));
    ad.addAdEventListener(AdEventType.ERROR, () => finish('unavailable'));
    ad.load();
  });
}

export const adsProvider: AdsProvider = {
  initialize: () => {
    initialization ??= initializeMobileAds();
    return initialization;
  },
  showInterstitial: async (placement) => {
    if (
      placement !== 'discover_swipe' ||
      !monetizationConfig.interstitialAdsEnabled ||
      interstitialInFlight ||
      !(await adsProvider.initialize())
    ) {
      return;
    }

    const now = Date.now();
    const decision = registerDiscoverAction(await readFrequencyState(), now);
    await saveFrequencyState(decision.state);
    if (!decision.shouldShow) return;

    interstitialInFlight = true;
    try {
      const shown = await showLoadedInterstitial(
        __DEV__ ? TestIds.INTERSTITIAL : monetizationConfig.discoverInterstitialAdUnitId!,
      );
      if (shown) await saveFrequencyState(recordInterstitialShown(decision.state, Date.now()));
    } finally {
      interstitialInFlight = false;
    }
  },
  showRewardedUndo: async (placement, userId) => {
    if (!monetizationConfig.rewardedAdsEnabled || !userId || !(await adsProvider.initialize())) {
      return 'unavailable';
    }
    return showRewarded(
      __DEV__ ? TestIds.REWARDED : monetizationConfig.rewardedUndoAdUnitId!,
      placement,
      userId,
    );
  },
};
