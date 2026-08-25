const { withGradleProperties } = require('expo/config-plugins');

const OPTIMIZED_RESOURCE_SHRINKING = 'android.r8.optimizedResourceShrinking';

/**
 * Expo SDK 57 uses AGP 8.12. Android recommends the optimized resource shrinker
 * for AGP 8.6 through 8.x when R8 and resource shrinking are enabled.
 */
module.exports = function withAndroidPerformance(config) {
  return withGradleProperties(config, (gradleConfig) => {
    const existingProperty = gradleConfig.modResults.find(
      (item) => item.type === 'property' && item.key === OPTIMIZED_RESOURCE_SHRINKING,
    );

    if (existingProperty) {
      existingProperty.value = 'true';
    } else {
      gradleConfig.modResults.push({
        type: 'property',
        key: OPTIMIZED_RESOURCE_SHRINKING,
        value: 'true',
      });
    }

    return gradleConfig;
  });
};
