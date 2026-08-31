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
    versionCode: 22,
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
          // Stability first for the closed-test build. R8/resource shrinking can be
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

// Native ad and purchase SDKs are intentionally excluded from the stability build.
// The service boundary stays in place so they can be restored after physical-device QA.
module.exports = () => baseConfig;
