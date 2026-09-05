import AsyncStorage from '@react-native-async-storage/async-storage';

import { monetizationConfig } from '@/features/monetization/config';
import { reportOperationalError } from '@/services/operational-error-service';
import type {
  AdsPrivacyOptionsStatus,
  AdsProvider,
  RewardedAdResult,
} from '@/features/monetization/services/types';
import {
  recordInterstitialShown,
  registerBrowseAction,
  registerDiscoverAction,
  type InterstitialFrequencyState,
} from '@/features/monetization/utils/ad-frequency-policy';

type MobileAdsModule = typeof import('react-native-google-mobile-ads');

const DISCOVER_FREQUENCY_STATE_KEY = 'wichu:ads:discover-frequency:v1';
const BROWSE_FREQUENCY_STATE_KEY = 'wichu:ads:browse-frequency:v1';
const LOAD_TIMEOUT_MS = 45_000;
const SHOW_TIMEOUT_MS = 65_000;
let sdkLoading: Promise<MobileAdsModule | null> | null = null;
let initialization: Promise<boolean> | null = null;
let interstitialInFlight = false;
type InterstitialInstance = ReturnType<MobileAdsModule['InterstitialAd']['createForAdRequest']>;
let discoverInterstitial: {
  ad: InterstitialInstance;
  adUnitId: string;
  loaded: boolean;
} | null = null;
let browseInterstitial: {
  ad: InterstitialInstance;
  adUnitId: string;
  loaded: boolean;
} | null = null;

/**
 * 네이티브 광고 모듈은 로그인과 프로필 설정이 끝난 뒤에만 평가한다.
 * 라우트 import 시점에 SDK를 읽지 않아 광고 연동 실패가 앱 실행을 막을 수 없다.
 */
function loadMobileAdsSdk() {
  sdkLoading ??= import('react-native-google-mobile-ads').catch((error) => {
    reportOperationalError('ad_sdk_import', error, '/monetization');
    return null;
  });
  return sdkLoading;
}

function shouldUseTestAds() {
  return __DEV__ || monetizationConfig.testMode;
}

function getDiscoverInterstitialAdUnitId(sdk: MobileAdsModule) {
  return shouldUseTestAds()
    ? sdk.TestIds.INTERSTITIAL
    : monetizationConfig.discoverInterstitialAdUnitId;
}

function getBrowseInterstitialAdUnitId(sdk: MobileAdsModule) {
  return shouldUseTestAds()
    ? sdk.TestIds.INTERSTITIAL
    : monetizationConfig.browseInterstitialAdUnitId;
}

function clearDiscoverInterstitial(slot = discoverInterstitial) {
  if (!slot) return;
  slot.ad.removeAllListeners();
  if (discoverInterstitial === slot) discoverInterstitial = null;
}

function ensureDiscoverInterstitialPreloaded(sdk: MobileAdsModule) {
  const adUnitId = getDiscoverInterstitialAdUnitId(sdk);
  if (!adUnitId || interstitialInFlight) return;
  if (discoverInterstitial?.adUnitId === adUnitId) return;

  clearDiscoverInterstitial();
  const slot = {
    ad: sdk.InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    }),
    adUnitId,
    loaded: false,
  };
  discoverInterstitial = slot;
  slot.ad.addAdEventListener(sdk.AdEventType.LOADED, () => {
    if (discoverInterstitial === slot) slot.loaded = true;
  });
  slot.ad.addAdEventListener(sdk.AdEventType.ERROR, (error) => {
    reportOperationalError('ad_discover_load', error, '/discover');
    clearDiscoverInterstitial(slot);
  });
  slot.ad.load();
}

function clearBrowseInterstitial(slot = browseInterstitial) {
  if (!slot) return;
  slot.ad.removeAllListeners();
  if (browseInterstitial === slot) browseInterstitial = null;
}

function ensureBrowseInterstitialPreloaded(sdk: MobileAdsModule) {
  const adUnitId = getBrowseInterstitialAdUnitId(sdk);
  if (!adUnitId || interstitialInFlight) return;
  if (browseInterstitial?.adUnitId === adUnitId) return;

  clearBrowseInterstitial();
  const slot = {
    ad: sdk.InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    }),
    adUnitId,
    loaded: false,
  };
  browseInterstitial = slot;
  slot.ad.addAdEventListener(sdk.AdEventType.LOADED, () => {
    if (browseInterstitial === slot) slot.loaded = true;
  });
  slot.ad.addAdEventListener(sdk.AdEventType.ERROR, (error) => {
    reportOperationalError('ad_browse_load', error, '/monetization');
    clearBrowseInterstitial(slot);
  });
  slot.ad.load();
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
    if (monetizationConfig.interstitialAdsEnabled) {
      ensureDiscoverInterstitialPreloaded(sdk);
      ensureBrowseInterstitialPreloaded(sdk);
    }
    return true;
  } catch (error) {
    reportOperationalError('ad_sdk_initialize', error, '/monetization');
    return false;
  }
}

async function readFrequencyState(key: string): Promise<InterstitialFrequencyState | null> {
  try {
    const stored = await AsyncStorage.getItem(key);
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

async function saveFrequencyState(key: string, state: InterstitialFrequencyState) {
  await AsyncStorage.setItem(key, JSON.stringify(state)).catch(() => undefined);
}

async function showPreloadedInterstitial(sdk: MobileAdsModule) {
  ensureDiscoverInterstitialPreloaded(sdk);
  const slot = discoverInterstitial;
  if (!slot?.loaded) return false;
  interstitialInFlight = true;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearDiscoverInterstitial(slot);
      interstitialInFlight = false;
      ensureDiscoverInterstitialPreloaded(sdk);
      ensureBrowseInterstitialPreloaded(sdk);
      resolve(shown);
    };
    const timeout = setTimeout(() => finish(false), SHOW_TIMEOUT_MS);
    slot.ad.removeAllListeners();
    slot.ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(true));
    slot.ad.addAdEventListener(sdk.AdEventType.ERROR, (error) => {
      reportOperationalError('ad_discover_show', error, '/discover');
      finish(false);
    });
    void slot.ad.show().catch((error) => {
      reportOperationalError('ad_discover_show', error, '/discover');
      finish(false);
    });
  });
}

async function showPreloadedBrowseInterstitial(sdk: MobileAdsModule) {
  ensureBrowseInterstitialPreloaded(sdk);
  const slot = browseInterstitial;
  if (!slot?.loaded) return false;
  interstitialInFlight = true;
  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (shown: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearBrowseInterstitial(slot);
      interstitialInFlight = false;
      ensureBrowseInterstitialPreloaded(sdk);
      ensureDiscoverInterstitialPreloaded(sdk);
      resolve(shown);
    };
    const timeout = setTimeout(() => finish(false), SHOW_TIMEOUT_MS);
    slot.ad.removeAllListeners();
    slot.ad.addAdEventListener(sdk.AdEventType.CLOSED, () => finish(true));
    slot.ad.addAdEventListener(sdk.AdEventType.ERROR, (error) => {
      reportOperationalError('ad_browse_show', error, '/monetization');
      finish(false);
    });
    void slot.ad.show().catch((error) => {
      reportOperationalError('ad_browse_show', error, '/monetization');
      finish(false);
    });
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
    ad.addAdEventListener(sdk.AdEventType.ERROR, (error) => {
      reportOperationalError('ad_rewarded_show', error, '/discover');
      finish('unavailable');
    });
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
      !['browse_transition', 'discover_swipe'].includes(placement) ||
      !monetizationConfig.interstitialAdsEnabled ||
      interstitialInFlight ||
      !(await adsProvider.initialize())
    ) {
      return;
    }

    const sdk = await loadMobileAdsSdk();
    if (!sdk) return;
    const now = Date.now();
    const isBrowse = placement === 'browse_transition';
    const frequencyKey = isBrowse ? BROWSE_FREQUENCY_STATE_KEY : DISCOVER_FREQUENCY_STATE_KEY;
    const decision = isBrowse
      ? registerBrowseAction(await readFrequencyState(frequencyKey), now)
      : registerDiscoverAction(await readFrequencyState(frequencyKey), now);
    await saveFrequencyState(frequencyKey, decision.state);
    if (!decision.shouldShow) return;

    const shown = isBrowse
      ? await showPreloadedBrowseInterstitial(sdk)
      : await showPreloadedInterstitial(sdk);
    if (shown) {
      await saveFrequencyState(frequencyKey, recordInterstitialShown(decision.state, Date.now()));
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
  getPrivacyOptionsStatus: async (): Promise<AdsPrivacyOptionsStatus> => {
    const sdk = await loadMobileAdsSdk();
    if (!sdk) return 'unavailable';
    try {
      const consent = await sdk.AdsConsent.getConsentInfo();
      if (
        consent.privacyOptionsRequirementStatus ===
        sdk.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED
      ) {
        return 'required';
      }
      return consent.privacyOptionsRequirementStatus ===
        sdk.AdsConsentPrivacyOptionsRequirementStatus.NOT_REQUIRED
        ? 'not_required'
        : 'unavailable';
    } catch (error) {
      reportOperationalError('ad_privacy_status', error, '/settings');
      return 'unavailable';
    }
  },
  showPrivacyOptions: async () => {
    const sdk = await loadMobileAdsSdk();
    if (!sdk) return false;
    try {
      await sdk.AdsConsent.showPrivacyOptionsForm();
      return true;
    } catch (error) {
      reportOperationalError('ad_privacy_form', error, '/settings');
      return false;
    }
  },
};
