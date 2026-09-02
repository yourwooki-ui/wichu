const { withAndroidManifest } = require('expo/config-plugins');

const MAIN_ACTIVITY_NAMES = new Set(['.MainActivity', 'app.wichu.mobile.MainActivity']);

/**
 * Keep Google Play purchase verification flows alive when the user temporarily
 * leaves WICHU for a banking app. RevenueCat requires `standard` or `singleTop`;
 * `singleTop` also preserves Expo Router deep-link delivery through onNewIntent.
 */
module.exports = function withAndroidMainActivityLaunchMode(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];
    const activities = application?.activity ?? [];
    const mainActivity = activities.find(
      (activity) => MAIN_ACTIVITY_NAMES.has(activity.$?.['android:name']),
    );

    if (!mainActivity?.$) {
      throw new Error('Unable to find the Expo MainActivity in the generated Android manifest.');
    }

    mainActivity.$['android:launchMode'] = 'singleTop';
    return manifestConfig;
  });
};
