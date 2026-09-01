import AsyncStorage from '@react-native-async-storage/async-storage';

import { monetizationConfig } from '@/features/monetization/config';
import type { AdsProvider, RewardedAdResult } from '@/features/monetization/services/types';
import {
  recordInterstitialShown,
  registerDiscoverAction,
  type InterstitialFrequencyState,
} from '@/features/monetization/utils/ad-frequency-policy';

type MobileAdsModule = typeof import('react-native-google-mobile-ads');

const FREQUENCY_STATE_KEY = 'wichu:ads:discover-frequency:v1';
const LOAD_TIMEOUT_MS = 45_000;
let sdkLoading: Promise<MobileAdsModule | null> | null = null;
let initialization: Promise<boolean> | null = null;
let interstitialInFlight = false;

/**
 * 네이티브 광고 모듈은 로그인과 프로필 설정이 끝난 뒤에만 평가한다.
 * 라우트 import 시점에 SDK를 읽지 않아 광고 연동 실패가 앱 실행을 막을 수 없다.
 */
function loadMobileAdsSdk() {
  sdkLoading ??= import('react-native-google-mobile-ads').catch(() => null);
  return sdkLoading;
}

function shouldUseTestAds() {
  return __DEV__ || monetizationConfig.testMode;
}

async function initializeMobileAds() {
  if (!monetizationConfig.rewardedAdsEnabled && !monetizationConfig.interstitialAdsEnabled) {
    return false;
  }

  try {
    const sdk = await loadMobileAdsSdk();
    if (!sdk) return false;
    const testDeviceIdentifiers = shouldUseTestAds() ? ['EMULATOR'] : undefined;
    const consent = await sdk.AdsConsent.gatherConsent({
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers,
    });
    if (!consent.canRequestAds) return false;

    await sdk.default().setRequestConfiguration({
      maxAdContentRating: sdk.MaxAdContentRating.T,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      testDeviceIdentifiers: testDeviceIdentifiers ?? [],
    });
    await sdk.default().initialize();
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

async function showLoadedInterstitial(sdk: MobileAdsModule, adUnitId: string) {
  const ad = sdk.InterstitialAd.createForAdRequest(adUnitId, {
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
    ad.addAdEventListener(sdk.AdEventType.LOADED, () => {
      void ad.show().catch(() => finish(false));
    });
    ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(true));
    ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish(false));
    ad.load();
  });
}

async function showRewarded(
  sdk: MobileAdsModule,
  adUnitId: string,
  placement: string,
  userId: string,
): Promise<RewardedAdResult> {
  const ad = sdk.RewardedAd.createForAdRequest(adUnitId, {
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
    ad.addAdEventListener(sdk.RewardedAdEventType.LOADED, () => {
      void ad.show().catch(() => finish('unavailable'));
    });
    ad.addAdEventListener(sdk.RewardedAdEventType.EARNED_REWARD, () => {
      earned = true;
    });
    ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(earned ? 'rewarded' : 'dismissed'));
    ad.addAdEventListener(sdk.AdEventType.ERROR, () => finish('unavailable'));
    ad.load();
  });
}

export const adsProvider: AdsProvider = {
  initialize: () => {
    if (!initialization) {
      initialization = initializeMobileAds().then((ready) => {
        if (!ready) initialization = null;
        return ready;
      });
    }
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

    const sdk = await loadMobileAdsSdk();
    if (!sdk) return;
    const now = Date.now();
    const decision = registerDiscoverAction(await readFrequencyState(), now);
    await saveFrequencyState(decision.state);
    if (!decision.shouldShow) return;

    interstitialInFlight = true;
    try {
      const adUnitId = shouldUseTestAds()
        ? sdk.TestIds.INTERSTITIAL
        : monetizationConfig.discoverInterstitialAdUnitId;
      if (!adUnitId) return;
      const shown = await showLoadedInterstitial(sdk, adUnitId);
      if (shown) await saveFrequencyState(recordInterstitialShown(decision.state, Date.now()));
    } finally {
      interstitialInFlight = false;
    }
  },
  showRewardedUndo: async (placement, userId) => {
    if (!monetizationConfig.rewardedAdsEnabled || !userId || !(await adsProvider.initialize())) {
      return 'unavailable';
    }
    const sdk = await loadMobileAdsSdk();
    if (!sdk) return 'unavailable';
    const adUnitId = shouldUseTestAds()
      ? sdk.TestIds.REWARDED
      : monetizationConfig.rewardedUndoAdUnitId;
    if (!adUnitId) return 'unavailable';
    return showRewarded(sdk, adUnitId, placement, userId);
  },
};
