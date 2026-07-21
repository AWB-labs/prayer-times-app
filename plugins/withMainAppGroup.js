const { withEntitlementsPlist } = require('@expo/config-plugins');

const APP_GROUP = 'group.com.badry.prayertimes';

/**
 * Adds the shared App Group entitlement to the MAIN app target so the
 * WidgetBridge native module can write prayer data into storage that the
 * widget extension reads. The widget target's own App Group is handled by
 * @bacons/apple-targets via expo-target.config.js.
 */
module.exports = function withMainAppGroup(config) {
  return withEntitlementsPlist(config, (cfg) => {
    const key = 'com.apple.security.application-groups';
    const existing = Array.isArray(cfg.modResults[key]) ? cfg.modResults[key] : [];
    if (!existing.includes(APP_GROUP)) {
      cfg.modResults[key] = [...existing, APP_GROUP];
    }
    return cfg;
  });
};
