const { withAndroidManifest } = require('expo/config-plugins');

// Registers the android.content.APP_RESTRICTIONS meta-data an MDM console reads to build
// its push-config UI (ticket 14). @xml/app_restrictions resolves from the res/xml file
// shipped inside modules/managed-config — Gradle merges it into the app automatically.
module.exports = function withManagedConfigRestrictions(config) {
  return withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application[0];
    application['meta-data'] = application['meta-data'] || [];
    application['meta-data'].push({
      $: {
        'android:name': 'android.content.APP_RESTRICTIONS',
        'android:resource': '@xml/app_restrictions',
      },
    });
    return config;
  });
};
