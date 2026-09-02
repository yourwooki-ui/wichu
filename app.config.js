const baseConfig = {
  name: 'WICHU',
  slug: 'wichu',
  version: '1.0.1',
  orientation: 'portrait',
  icon: './assets/brand/wichu-app-icon.png',
  scheme: 'wichu',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'app.wichu.mobile',
    infoPlist: {
      CFBundleAllowMixedLocalizations: true,
    },
  },
  android: {
    versionCode: 25,
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/brand/wichu-app-icon.png',
    },
    package: 'app.wichu.mobile',
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.ACCESS_COARSE_LOCATION', 'com.android.vending.BILLING'],
    blockedPermissions: [
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
  },
  web: {
    favicon: './assets/brand/wichu-app-icon.png',
  },
  locales: {
    ko: './locales/ko.json',
    en: './locales/en.json',
    vi: './locales/vi.json',
    ja: './locales/ja.json',
    fr: './locales/fr.json',
    es: './locales/es.json',
    'pt-BR': './locales/pt-BR.json',
    'zh-TW': './locales/zh-TW.json',
    id: './locales/id.json',
    fa: './locales/fa.json',
  },
  plugins: [
    [
      'expo-build-properties',
      {
        android: {
          // Stability first for release builds. R8/resource shrinking can be
          // reintroduced only after a release APK has passed physical-device startup QA.
          enableMinifyInReleaseBuilds: false,
          enableShrinkResourcesInReleaseBuilds: false,
        },
      },
    ],
    [
      'expo-router',
      {
        asyncRoutes: {
          web: false,
          default: false,
        },
      },
    ],
    'expo-image',
    [
      'expo-image-picker',
      {
        photosPermission:
          'WICHU accesses your photos so you can build your profile and share images in chats.',
        cameraPermission: 'WICHU uses your camera so you can take a profile photo.',
        microphonePermission: false,
      },
    ],
    [
      'expo-localization',
      {
        supportedLocales: ['ko', 'en', 'vi', 'ja', 'fr', 'es', 'pt-BR', 'zh-TW', 'id', 'fa'],
        supportsRTL: true,
      },
    ],
    [
      'expo-notifications',
      {
        color: '#FF2D6F',
        defaultChannel: 'wichu-default',
        icon: './assets/notification-icon.png',
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'WICHU가 프로필 간 거리를 계산할 수 있도록 앱 사용 중 위치를 허용해주세요. 정확한 좌표는 다른 사용자에게 공개되지 않습니다.',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/brand/wichu-app-icon.png',
        imageWidth: 168,
        resizeMode: 'contain',
        dark: {
          backgroundColor: '#FFFFFF',
          image: './assets/brand/wichu-app-icon.png',
        },
      },
    ],
    [
      'expo-web-browser',
      {
        experimentalLauncherActivity: false,
      },
    ],
    'expo-font',
    'expo-secure-store',
  ],
  extra: {
    router: {},
    eas: {
      projectId: 'fad04bf6-9774-48c0-b2eb-e42674f0dc01',
    },
  },
  owner: 'withyouwichu',
};

// Google's official sample app IDs keep the native ContentProvider valid in local and
// closed-test builds before production AdMob IDs are provisioned. Real ads are still
// fail-closed in src/features/monetization/config.ts.
const TEST_ADMOB_APP_IDS = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

function enabled(value) {
  return value?.trim().toLowerCase() === 'true';
}

function validRevenueCatAndroidKey(value) {
  return /^goog_[A-Za-z0-9_-]{8,}$/.test(value ?? '');
}

function validAdMobAppId(value) {
  return /^ca-app-pub-\d{16}~\d{10}$/.test(value ?? '');
}

function validAdMobUnitId(value) {
  return /^ca-app-pub-\d{16}\/\d{10}$/.test(value ?? '');
}

function getAdMobAppId(platform) {
  const configured =
    platform === 'android'
      ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID
      : process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID;
  return configured?.trim() || TEST_ADMOB_APP_IDS[platform];
}

module.exports = () => {
  const androidAppId = getAdMobAppId('android');
  const iosAppId = getAdMobAppId('ios');
  const adsEnabled =
    enabled(process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED) ||
    enabled(process.env.EXPO_PUBLIC_INTERSTITIAL_ADS_ENABLED);
  const testMode = enabled(process.env.EXPO_PUBLIC_MONETIZATION_TEST_MODE);
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const buildPlatform = process.env.EAS_BUILD_PLATFORM;
  const isProductionAndroid = isProductionBuild && buildPlatform !== 'ios';
  const missingProductionAppId =
    (buildPlatform !== 'ios' && androidAppId === TEST_ADMOB_APP_IDS.android) ||
    (buildPlatform !== 'android' && iosAppId === TEST_ADMOB_APP_IDS.ios);

  if (isProductionBuild && testMode) {
    throw new Error('Production builds cannot enable monetization test mode.');
  }
  if (isProductionBuild && adsEnabled && missingProductionAppId) {
    throw new Error('Production ads require a real AdMob app ID for the target platform.');
  }
  if (isProductionAndroid) {
    const requiredProductionValues = [
      [
        'EXPO_PUBLIC_MONETIZATION_ENABLED=true',
        enabled(process.env.EXPO_PUBLIC_MONETIZATION_ENABLED),
      ],
      [
        'EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_*',
        validRevenueCatAndroidKey(process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY),
      ],
      [
        'EXPO_PUBLIC_REWARDED_ADS_ENABLED=true',
        enabled(process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED),
      ],
      [
        'EXPO_PUBLIC_INTERSTITIAL_ADS_ENABLED=true',
        enabled(process.env.EXPO_PUBLIC_INTERSTITIAL_ADS_ENABLED),
      ],
      [
        'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
        androidAppId !== TEST_ADMOB_APP_IDS.android && validAdMobAppId(androidAppId),
      ],
      [
        'EXPO_PUBLIC_ADMOB_REWARDED_UNDO_ANDROID_UNIT_ID',
        validAdMobUnitId(process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNDO_ANDROID_UNIT_ID),
      ],
      [
        'EXPO_PUBLIC_ADMOB_DISCOVER_INTERSTITIAL_ANDROID_UNIT_ID',
        validAdMobUnitId(process.env.EXPO_PUBLIC_ADMOB_DISCOVER_INTERSTITIAL_ANDROID_UNIT_ID),
      ],
      [
        'EXPO_PUBLIC_ADMOB_BROWSE_INTERSTITIAL_ANDROID_UNIT_ID',
        validAdMobUnitId(process.env.EXPO_PUBLIC_ADMOB_BROWSE_INTERSTITIAL_ANDROID_UNIT_ID),
      ],
    ];
    const missing = requiredProductionValues
      .filter(([, configured]) => !configured)
      .map(([name]) => name);
    if (missing.length > 0) {
      throw new Error(
        `Production Android monetization configuration is incomplete: ${missing.join(', ')}`,
      );
    }
  }

  return {
    ...baseConfig,
    plugins: [
      ...baseConfig.plugins,
      [
        'react-native-google-mobile-ads',
        {
          androidAppId,
          iosAppId,
          delayAppMeasurementInit: true,
          optimizeInitialization: true,
          optimizeAdLoading: true,
          userTrackingUsageDescription:
            'WICHU may use a device identifier to measure ad performance and show relevant ads.',
        },
      ],
    ],
  };
};
