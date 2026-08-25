const baseConfig = {
  name: 'WICHU',
  slug: 'wichu',
  version: '1.0.0',
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
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/brand/wichu-app-icon.png',
    },
    package: 'app.wichu.mobile',
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.ACCESS_COARSE_LOCATION'],
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
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
    './plugins/with-android-performance',
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
        backgroundColor: '#000000',
        image: './assets/brand/wichu-splash.png',
        imageWidth: 320,
        resizeMode: 'contain',
        dark: {
          backgroundColor: '#000000',
          image: './assets/brand/wichu-splash.png',
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

const TEST_ADMOB_APP_IDS = {
  android: 'ca-app-pub-3940256099942544~3347511713',
  ios: 'ca-app-pub-3940256099942544~1458002511',
};

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
    process.env.EXPO_PUBLIC_REWARDED_ADS_ENABLED === 'true' ||
    process.env.EXPO_PUBLIC_INTERSTITIAL_ADS_ENABLED === 'true';
  const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production';
  const buildPlatform = process.env.EAS_BUILD_PLATFORM;
  const missingProductionAppId =
    (buildPlatform !== 'ios' && androidAppId === TEST_ADMOB_APP_IDS.android) ||
    (buildPlatform !== 'android' && iosAppId === TEST_ADMOB_APP_IDS.ios);

  if (isProductionBuild && adsEnabled && missingProductionAppId) {
    throw new Error(
      'Production ads are enabled without a real AdMob app ID for the target platform.',
    );
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
