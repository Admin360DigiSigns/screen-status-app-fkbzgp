
const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Custom config plugin to configure Android TV settings
 */
module.exports = function withAndroidTV(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Set the app as a TV app
    mainApplication.$['android:isGame'] = 'false';
    mainApplication.$['android:banner'] = '@mipmap/ic_launcher';

    // Find or create the main activity
    const mainActivity = mainApplication.activity?.find(
      (activity) =>
        activity['intent-filter']?.some((filter) =>
          filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN')
        )
    );

    if (mainActivity) {
      // Set screen orientation to landscape for TV
      mainActivity.$['android:screenOrientation'] = 'landscape';
      
      // Ensure the LEANBACK_LAUNCHER category is present
      const intentFilters = mainActivity['intent-filter'] || [];
      const mainIntentFilter = intentFilters.find((filter) =>
        filter.action?.some((action) => action.$['android:name'] === 'android.intent.action.MAIN')
      );

      if (mainIntentFilter) {
        const categories = mainIntentFilter.category || [];
        const hasLeanback = categories.some(
          (cat) => cat.$['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
        );

        if (!hasLeanback) {
          categories.push({
            $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' },
          });
          mainIntentFilter.category = categories;
        }
      }
    }

    // Add uses-feature declarations for TV
    if (!androidManifest.manifest['uses-feature']) {
      androidManifest.manifest['uses-feature'] = [];
    }

    const usesFeatures = androidManifest.manifest['uses-feature'];

    // Touchscreen not required for TV
    const touchscreenFeature = usesFeatures.find(
      (feature) => feature.$['android:name'] === 'android.hardware.touchscreen'
    );
    if (!touchscreenFeature) {
      usesFeatures.push({
        $: {
          'android:name': 'android.hardware.touchscreen',
          'android:required': 'false',
        },
      });
    } else {
      touchscreenFeature.$['android:required'] = 'false';
    }

    // Leanback (TV) feature required
    const leanbackFeature = usesFeatures.find(
      (feature) => feature.$['android:name'] === 'android.software.leanback'
    );
    if (!leanbackFeature) {
      usesFeatures.push({
        $: {
          'android:name': 'android.software.leanback',
          'android:required': 'true',
        },
      });
    }

    console.log('✅ Android TV configuration applied successfully');
    return config;
  });
};
