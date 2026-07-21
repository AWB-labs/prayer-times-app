/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  // Deployment target: the widget uses `.containerBackground(for: .widget)` (iOS 17+).
  deploymentTarget: "17.0",
  // Shared App Group so the widget can read the prayer data the app writes.
  entitlements: {
    "com.apple.security.application-groups": ["group.com.badry.prayertimes"],
  },
});
