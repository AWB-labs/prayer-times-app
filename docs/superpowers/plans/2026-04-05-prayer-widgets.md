# Prayer Times Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add iOS WidgetKit and Android AppWidget home-screen widgets showing the next prayer name/time and a live per-minute countdown, sharing data from the React Native app via platform-specific shared storage.

**Architecture:** The RN app writes a JSON prayer payload to shared storage (iOS: App Groups UserDefaults / Android: SharedPreferences) via a native module (`WidgetBridge`) after every successful prayer times fetch and on foreground resume. The iOS widgets use WidgetKit with pre-scheduled per-minute Timeline entries for the countdown. Android uses AppWidget + AlarmManager for 60-second update cycles. An Expo Config Plugin automates all native project file mutations so `expo prebuild` remains reproducible.

**Tech Stack:** Expo SDK 54 bare workflow, expo-modules-core (native bridge), WidgetKit + SwiftUI (iOS 16+), AppWidget + Kotlin (Android), @expo/config-plugins + xcode npm package (project automation)

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/utils/widgetPayload.ts` | Create | Builds `WidgetPayload` from `PrayerData` |
| `src/modules/WidgetBridge.ts` | Create | TS wrapper around native module |
| `src/hooks/usePrayerTimes.ts` | Modify | Call WidgetBridge after successful fetch |
| `App.tsx` | Modify | Re-sync widget data on foreground resume |
| `ios/WidgetBridge/WidgetBridgeModule.swift` | Create | Writes to App Group UserDefaults, reloads timelines |
| `ios/PrayerTimesWidget/PrayerTimesWidget.swift` | Create | Both widget providers + SwiftUI views |
| `ios/PrayerTimesWidget/Info.plist` | Create | Widget extension metadata |
| `ios/PrayerTimesWidget/PrayerTimesWidget.entitlements` | Create | App Group claim for extension |
| `ios/prayer-times-app/prayer-times-app.entitlements` | Modify | App Group claim for main app |
| `android/app/src/main/java/com/prayertimes/app/WidgetBridgeModule.kt` | Create | Writes to SharedPreferences, broadcasts update |
| `android/app/src/main/java/com/prayertimes/app/WidgetBridgePackage.kt` | Create | Registers module with RN |
| `android/app/src/main/java/com/prayertimes/app/NextPrayerWidget.kt` | Create | Static next-prayer AppWidgetProvider |
| `android/app/src/main/java/com/prayertimes/app/CountdownWidget.kt` | Create | Per-minute countdown AppWidgetProvider |
| `android/app/src/main/res/layout/next_prayer_widget.xml` | Create | RemoteViews layout |
| `android/app/src/main/res/layout/countdown_widget.xml` | Create | RemoteViews layout |
| `android/app/src/main/res/xml/next_prayer_widget_info.xml` | Create | AppWidget metadata |
| `android/app/src/main/res/xml/countdown_widget_info.xml` | AppWidget metadata |
| `android/app/src/main/res/drawable/widget_background.xml` | Create | Rounded black bg shape |
| `plugins/withiOSWidget.ts` | Create | Config Plugin — iOS entitlements + Xcode target |
| `plugins/withAndroidWidget.ts` | Create | Config Plugin — manifest receivers + resources |
| `app.json` | Modify | Register both plugins |

---

## Task 1: Run expo prebuild

**Files:**
- Create: `ios/` (generated)
- Create: `android/` (generated)

- [ ] **Step 1: Run prebuild**

```bash
npx expo prebuild --clean --platform all
```

Expected output ends with: `✔ Created native project in ios/` and `✔ Created native project in android/`

- [ ] **Step 2: Verify structure**

```bash
ls ios/
ls android/app/src/main/java/
```

Expected: `ios/prayer-times-app.xcodeproj/`, `ios/prayer-times-app/`, `android/app/src/main/java/com/prayertimes/app/`

- [ ] **Step 3: Commit base native dirs**

```bash
git add ios/ android/
git commit -m "chore: generate bare workflow native dirs via expo prebuild"
```

---

## Task 2: Create widget payload utility

**Files:**
- Create: `src/utils/widgetPayload.ts`

`Prayer` has `{ name, arabicName, time: string }` where `time` is already cleaned to `"HH:MM"` 24h by `buildPrayerList`. `PrayerData.timings` feeds into `buildPrayerList` which returns `Prayer[]`. The widget payload is built from that `Prayer[]`.

- [ ] **Step 1: Create the file**

Create `src/utils/widgetPayload.ts`:

```typescript
import { Prayer, PrayerData } from '../types';
import { buildPrayerList } from './prayerUtils';

export interface WidgetPrayer {
  name: string;
  arabicName: string;
  time: string;        // "HH:MM" 24h
  timestamp: number;   // Unix seconds for today's occurrence
}

export interface WidgetPayload {
  prayers: WidgetPrayer[];
  nextPrayerIndex: number;
  nextPrayerName: string;
  nextPrayerTimestamp: number; // Unix seconds — what countdown targets
  date: string;               // "YYYY-MM-DD"
}

/** Converts "HH:MM" time string to Unix timestamp for today (local time) */
function prayerTimeToTimestamp(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function todayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildWidgetPayload(prayerData: PrayerData): WidgetPayload {
  const now = Math.floor(Date.now() / 1000);
  const prayers = buildPrayerList(prayerData.timings);

  const widgetPrayers: WidgetPrayer[] = prayers.map((p) => ({
    name: p.name,
    arabicName: p.arabicName,
    time: p.time,
    timestamp: prayerTimeToTimestamp(p.time),
  }));

  // First prayer whose timestamp is still in the future
  let nextPrayerIndex = widgetPrayers.findIndex((p) => p.timestamp > now);
  if (nextPrayerIndex === -1) nextPrayerIndex = 0; // all passed → wrap to Fajr

  return {
    prayers: widgetPrayers,
    nextPrayerIndex,
    nextPrayerName: widgetPrayers[nextPrayerIndex].name,
    nextPrayerTimestamp: widgetPrayers[nextPrayerIndex].timestamp,
    date: todayDateString(),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/widgetPayload.ts
git commit -m "feat: add buildWidgetPayload utility"
```

---

## Task 3: Create WidgetBridge TypeScript module

**Files:**
- Create: `src/modules/WidgetBridge.ts`

- [ ] **Step 1: Create the file**

Create `src/modules/WidgetBridge.ts`:

```typescript
import { NativeModules, Platform } from 'react-native';
import type { WidgetPayload } from '../utils/widgetPayload';

interface NativeWidgetBridge {
  setPrayerData(data: WidgetPayload): Promise<void>;
  reloadAllTimelines(): Promise<void>;
}

const { WidgetBridge: Native } = NativeModules as {
  WidgetBridge: NativeWidgetBridge | undefined;
};

export const WidgetBridge = {
  /** Writes prayer data to shared storage and reloads widget timelines. */
  async setPrayerData(data: WidgetPayload): Promise<void> {
    if (!Native) return;
    return Native.setPrayerData(data);
  },

  /** iOS only: forces WidgetKit to immediately re-fetch all timelines. */
  async reloadAllTimelines(): Promise<void> {
    if (!Native || Platform.OS !== 'ios') return;
    return Native.reloadAllTimelines();
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/modules/WidgetBridge.ts
git commit -m "feat: add WidgetBridge TypeScript module"
```

---

## Task 4: Create iOS WidgetBridge native module

**Files:**
- Create: `ios/WidgetBridge/WidgetBridgeModule.swift`

This uses `expo-modules-core` which is already a transitive dependency of Expo SDK 54. In bare workflow after prebuild, `ExpoModulesProvider.swift` is auto-generated and picks up all `Module` subclasses automatically — no manual registration needed.

- [ ] **Step 1: Create the directory and Swift file**

```bash
mkdir -p ios/WidgetBridge
```

Create `ios/WidgetBridge/WidgetBridgeModule.swift`:

```swift
import ExpoModulesCore
import WidgetKit

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    AsyncFunction("setPrayerData") { (data: [String: Any], promise: Promise) in
      do {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        let defaults = UserDefaults(suiteName: "group.com.prayertimes.app")
        defaults?.set(jsonData, forKey: "prayerData")
        defaults?.synchronize()
        if #available(iOS 14.0, *) {
          WidgetCenter.shared.reloadAllTimelines()
        }
        promise.resolve(nil)
      } catch {
        promise.reject("WIDGET_BRIDGE_ERROR", error.localizedDescription)
      }
    }

    AsyncFunction("reloadAllTimelines") { (promise: Promise) in
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      promise.resolve(nil)
    }
  }
}
```

- [ ] **Step 2: Add WidgetKit framework to main app target in Xcode**

Open `ios/prayer-times-app.xcworkspace` in Xcode:
1. Select the `prayer-times-app` project in the navigator
2. Select the `prayer-times-app` target → Build Phases → Link Binary With Libraries
3. Click `+` → search `WidgetKit` → Add

This lets the main app call `WidgetCenter.shared.reloadAllTimelines()`.

- [ ] **Step 3: Add the Swift file to the Xcode project**

In Xcode:
1. Right-click `prayer-times-app` group in navigator → New Group → name it `WidgetBridge`
2. Right-click the new group → Add Files → select `ios/WidgetBridge/WidgetBridgeModule.swift`
3. Ensure "Add to targets: prayer-times-app" is checked, uncheck the widget extension target

- [ ] **Step 4: Commit**

```bash
git add ios/WidgetBridge/
git add ios/prayer-times-app.xcodeproj/project.pbxproj
git commit -m "feat: add iOS WidgetBridge native module"
```

---

## Task 5: Create iOS Widget Extension Swift code

**Files:**
- Create: `ios/PrayerTimesWidget/PrayerTimesWidget.swift`
- Create: `ios/PrayerTimesWidget/Info.plist`
- Create: `ios/PrayerTimesWidget/PrayerTimesWidget.entitlements`

- [ ] **Step 1: Create the widget directory**

```bash
mkdir -p ios/PrayerTimesWidget
```

- [ ] **Step 2: Create PrayerTimesWidget.swift**

Create `ios/PrayerTimesWidget/PrayerTimesWidget.swift`:

```swift
import WidgetKit
import SwiftUI

// MARK: - Shared Data

struct WidgetPrayer: Codable {
    let name: String
    let arabicName: String
    let time: String
    let timestamp: TimeInterval
}

struct WidgetData: Codable {
    let prayers: [WidgetPrayer]
    let nextPrayerIndex: Int
    let nextPrayerName: String
    let nextPrayerTimestamp: TimeInterval
    let date: String

    static func load() -> WidgetData? {
        guard
            let defaults = UserDefaults(suiteName: "group.com.prayertimes.app"),
            let data = defaults.data(forKey: "prayerData")
        else { return nil }
        return try? JSONDecoder().decode(WidgetData.self, from: data)
    }

    static var placeholder: WidgetData {
        WidgetData(
            prayers: [WidgetPrayer(name: "Dhuhr", arabicName: "الظهر", time: "12:10", timestamp: Date().timeIntervalSince1970 + 3600)],
            nextPrayerIndex: 0,
            nextPrayerName: "Dhuhr",
            nextPrayerTimestamp: Date().timeIntervalSince1970 + 3600,
            date: "2026-01-01"
        )
    }
}

// MARK: - Colors

extension Color {
    static let widgetBg      = Color(red: 0,       green: 0,       blue: 0)
    static let widgetGold    = Color(red: 201/255, green: 162/255, blue: 39/255)
    static let widgetSubtext = Color.white.opacity(0.55)
    static let widgetMuted   = Color.white.opacity(0.30)
}

// MARK: - Time Formatter

private func formatTime(_ timeStr: String) -> String {
    let parts = timeStr.split(separator: ":").compactMap { Int($0) }
    guard parts.count == 2 else { return timeStr }
    let h = parts[0], m = parts[1]
    let period = h >= 12 ? "PM" : "AM"
    let h12 = h == 0 ? 12 : (h > 12 ? h - 12 : h)
    return String(format: "%d:%02d %@", h12, m, period)
}

// MARK: - Next Prayer Widget

struct NextPrayerEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let arabicName: String
    let prayerTime: String
    let nextTimestamp: TimeInterval
}

struct NextPrayerProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextPrayerEntry {
        makeEntry()
    }

    func getSnapshot(in context: Context, completion: @escaping (NextPrayerEntry) -> Void) {
        completion(makeEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextPrayerEntry>) -> Void) {
        let entry = makeEntry()
        // Reload exactly when this prayer time arrives
        let refreshDate = Date(timeIntervalSince1970: entry.nextTimestamp)
        completion(Timeline(entries: [entry], policy: .after(refreshDate)))
    }

    private func makeEntry() -> NextPrayerEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let prayer = data.prayers[data.nextPrayerIndex]
        return NextPrayerEntry(
            date: Date(),
            prayerName: data.nextPrayerName,
            arabicName: prayer.arabicName,
            prayerTime: prayer.time,
            nextTimestamp: data.nextPrayerTimestamp
        )
    }
}

struct NextPrayerView: View {
    let entry: NextPrayerEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color.widgetBg
            VStack(spacing: 4) {
                Text("NEXT PRAYER")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(2.5)
                    .foregroundColor(.widgetMuted)

                Text(entry.prayerName)
                    .font(.system(size: family == .systemSmall ? 22 : 30, weight: .bold))
                    .foregroundColor(.white)

                Text(entry.arabicName)
                    .font(.system(size: 13))
                    .foregroundColor(.widgetSubtext)

                Spacer().frame(height: 6)

                Text(formatTime(entry.prayerTime))
                    .font(.system(size: family == .systemSmall ? 18 : 24, weight: .semibold, design: .rounded))
                    .foregroundColor(.widgetGold)
            }
            .padding()
        }
        .containerBackground(.black, for: .widget)
    }
}

struct NextPrayerWidget: Widget {
    let kind = "NextPrayerWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextPrayerProvider()) { entry in
            NextPrayerView(entry: entry)
        }
        .configurationDisplayName("Next Prayer")
        .description("Shows the next upcoming prayer and its time.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Countdown Widget

struct CountdownEntry: TimelineEntry {
    let date: Date
    let prayerName: String
    let arabicName: String
    let hoursLeft: Int
    let minutesLeft: Int
    let nextTimestamp: TimeInterval
}

struct CountdownProvider: TimelineProvider {
    func placeholder(in context: Context) -> CountdownEntry {
        CountdownEntry(date: Date(), prayerName: "Dhuhr", arabicName: "الظهر",
                       hoursLeft: 1, minutesLeft: 2,
                       nextTimestamp: Date().timeIntervalSince1970 + 3720)
    }

    func getSnapshot(in context: Context, completion: @escaping (CountdownEntry) -> Void) {
        completion(makeEntry(at: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<CountdownEntry>) -> Void) {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let nextDate = Date(timeIntervalSince1970: data.nextPrayerTimestamp)
        let prayer = data.prayers[data.nextPrayerIndex]
        let now = Date()

        // Pre-generate one entry per minute for up to 60 minutes ahead
        var entries: [CountdownEntry] = []
        for i in 0..<60 {
            let entryDate = now.addingTimeInterval(Double(i) * 60)
            if entryDate >= nextDate { break }
            let remaining = nextDate.timeIntervalSince(entryDate)
            entries.append(CountdownEntry(
                date: entryDate,
                prayerName: data.nextPrayerName,
                arabicName: prayer.arabicName,
                hoursLeft: Int(remaining) / 3600,
                minutesLeft: (Int(remaining) % 3600) / 60,
                nextTimestamp: data.nextPrayerTimestamp
            ))
        }

        if entries.isEmpty { entries.append(makeEntry(at: now)) }
        // After all entries expire, reload immediately after the prayer time
        completion(Timeline(entries: entries, policy: .after(nextDate)))
    }

    private func makeEntry(at date: Date) -> CountdownEntry {
        let data = WidgetData.load() ?? WidgetData.placeholder
        let prayer = data.prayers[data.nextPrayerIndex]
        let nextDate = Date(timeIntervalSince1970: data.nextPrayerTimestamp)
        let remaining = max(0, nextDate.timeIntervalSince(date))
        return CountdownEntry(
            date: date,
            prayerName: data.nextPrayerName,
            arabicName: prayer.arabicName,
            hoursLeft: Int(remaining) / 3600,
            minutesLeft: (Int(remaining) % 3600) / 60,
            nextTimestamp: data.nextPrayerTimestamp
        )
    }
}

struct CountdownView: View {
    let entry: CountdownEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            Color.widgetBg
            VStack(spacing: 4) {
                Text("TIME TO")
                    .font(.system(size: 9, weight: .semibold))
                    .tracking(2.5)
                    .foregroundColor(.widgetMuted)

                Text(entry.prayerName)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.widgetGold)

                Spacer().frame(height: 6)

                if entry.hoursLeft > 0 {
                    HStack(alignment: .lastTextBaseline, spacing: 3) {
                        Text("\(entry.hoursLeft)")
                            .font(.system(size: family == .systemSmall ? 30 : 40, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("h")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.widgetSubtext)
                        Text("\(entry.minutesLeft)")
                            .font(.system(size: family == .systemSmall ? 30 : 40, weight: .bold, design: .rounded))
                            .foregroundColor(.white)
                        Text("m")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.widgetSubtext)
                    }
                } else {
                    HStack(alignment: .lastTextBaseline, spacing: 3) {
                        Text("\(entry.minutesLeft)")
                            .font(.system(size: family == .systemSmall ? 38 : 50, weight: .bold, design: .rounded))
                            .foregroundColor(.widgetGold)
                        Text("min")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.widgetSubtext)
                    }
                }

                Text("remaining")
                    .font(.system(size: 10))
                    .foregroundColor(.widgetMuted)
            }
            .padding()
        }
        .containerBackground(.black, for: .widget)
    }
}

struct CountdownWidget: Widget {
    let kind = "CountdownWidget"
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CountdownProvider()) { entry in
            CountdownView(entry: entry)
        }
        .configurationDisplayName("Prayer Countdown")
        .description("Counts down to the next prayer, updating every minute.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Bundle Entry Point

@main
struct PrayerTimesWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextPrayerWidget()
        CountdownWidget()
    }
}
```

- [ ] **Step 3: Create Info.plist**

Create `ios/PrayerTimesWidget/Info.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
</dict>
</plist>
```

- [ ] **Step 4: Create extension entitlements**

Create `ios/PrayerTimesWidget/PrayerTimesWidget.entitlements`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>group.com.prayertimes.app</string>
    </array>
</dict>
</plist>
```

- [ ] **Step 5: Commit Swift files**

```bash
git add ios/PrayerTimesWidget/
git commit -m "feat: add iOS widget extension Swift files"
```

---

## Task 6: Add iOS Widget Extension Xcode Target

The widget extension must be a separate Xcode target. This step adds it programmatically using a Node.js script so it can be re-run if needed.

**Files:**
- Create: `scripts/addWidgetTarget.js`

- [ ] **Step 1: Create the setup script**

Create `scripts/addWidgetTarget.js`:

```javascript
const xcode = require('xcode');
const path = require('path');
const fs = require('fs');

const PROJ_PATH = path.join(__dirname, '../ios/prayer-times-app.xcodeproj/project.pbxproj');
const WIDGET_TARGET = 'PrayerTimesWidget';
const WIDGET_BUNDLE_ID = 'com.prayertimes.app.widget';
const WIDGET_DIR = path.join(__dirname, '../ios/PrayerTimesWidget');
const APP_GROUP = 'group.com.prayertimes.app';

const project = xcode.project(PROJ_PATH);

project.parse(function (err) {
  if (err) { console.error('Parse error:', err); process.exit(1); }

  // Bail if already added
  const targets = project.pbxNativeTargetSection();
  const alreadyExists = Object.values(targets).some(
    (t) => t && t.name === WIDGET_TARGET
  );
  if (alreadyExists) {
    console.log('Widget target already exists, skipping.');
    return;
  }

  // Add the extension target (xcode pkg creates Sources/Resources/Frameworks phases)
  const widgetTarget = project.addTarget(
    WIDGET_TARGET,
    'app_extension',
    WIDGET_TARGET,
    WIDGET_BUNDLE_ID
  );

  // Add Swift source file
  project.addSourceFile(
    `${WIDGET_TARGET}/PrayerTimesWidget.swift`,
    { target: widgetTarget.uuid }
  );

  // Add Info.plist as a resource
  project.addResourceFile(
    `${WIDGET_TARGET}/Info.plist`,
    { target: widgetTarget.uuid }
  );

  // Add WidgetKit and SwiftUI frameworks
  project.addFramework('WidgetKit.framework',  { target: widgetTarget.uuid });
  project.addFramework('SwiftUI.framework',    { target: widgetTarget.uuid });

  // Build settings for the widget target
  const configs = project.pbxXCBuildConfigurationSection();
  const targetConfigListUUID = project.pbxNativeTargetSection()[widgetTarget.uuid].buildConfigurationList;
  const targetConfigList = project.pbxXCConfigurationList()[targetConfigListUUID];
  const configUUIDs = targetConfigList.buildConfigurations.map((c) => c.value);

  configUUIDs.forEach((uuid) => {
    const cfg = configs[uuid];
    if (!cfg || !cfg.buildSettings) return;
    Object.assign(cfg.buildSettings, {
      SWIFT_VERSION: '"5.0"',
      TARGETED_DEVICE_FAMILY: '"1,2"',
      IPHONEOS_DEPLOYMENT_TARGET: '"16.0"',
      PRODUCT_BUNDLE_IDENTIFIER: `"${WIDGET_BUNDLE_ID}"`,
      PRODUCT_NAME: `"${WIDGET_TARGET}"`,
      SKIP_INSTALL: 'YES',
      SWIFT_EMIT_LOC_STRINGS: 'YES',
      CODE_SIGN_ENTITLEMENTS: `"${WIDGET_TARGET}/${WIDGET_TARGET}.entitlements"`,
    });
  });

  // Embed the extension in the main app target via a CopyFiles build phase
  // dstSubfolderSpec = 13 means PlugIns destination
  const mainTarget = project.getFirstTarget();
  project.addBuildPhase(
    [`${WIDGET_TARGET}.appex`],
    'PBXCopyFilesBuildPhase',
    'Embed App Extensions',
    mainTarget.uuid,
    // options object: dstSubfolderSpec 13 = PlugIns, attributes = [CodeSignOnCopy]
    { dstSubfolderSpec: 13, ATTRIBUTES: ['CodeSignOnCopy'] }
  );

  fs.writeFileSync(PROJ_PATH, project.writeSync());
  console.log(`✅ Widget target '${WIDGET_TARGET}' added to Xcode project.`);
});
```

- [ ] **Step 2: Run the script**

```bash
node scripts/addWidgetTarget.js
```

Expected: `✅ Widget target 'PrayerTimesWidget' added to Xcode project.`

- [ ] **Step 3: Open project in Xcode and verify**

```bash
open ios/prayer-times-app.xcworkspace
```

In Xcode, confirm:
- `PrayerTimesWidget` appears as a target in the target list
- `PrayerTimesWidget/PrayerTimesWidget.swift` appears in the file navigator
- Build Phases → Embed App Extensions contains `PrayerTimesWidget.appex`

- [ ] **Step 4: Add App Group capability to main app**

Still in Xcode:
1. Select the `prayer-times-app` target → Signing & Capabilities
2. Click `+ Capability` → App Groups
3. Add `group.com.prayertimes.app`

This writes to `ios/prayer-times-app/prayer-times-app.entitlements`. If the file already exists, Xcode appends. Verify it contains:

```xml
<key>com.apple.security.application-groups</key>
<array>
    <string>group.com.prayertimes.app</string>
</array>
```

> **Note:** You must also register the App Group in your Apple Developer account at developer.apple.com → Identifiers → App Groups.

- [ ] **Step 5: Commit**

```bash
git add scripts/addWidgetTarget.js
git add ios/prayer-times-app.xcodeproj/project.pbxproj
git add ios/prayer-times-app/prayer-times-app.entitlements
git commit -m "feat: add PrayerTimesWidget Xcode target and App Group capability"
```

---

## Task 7: Create Android WidgetBridge native module

**Files:**
- Create: `android/app/src/main/java/com/prayertimes/app/WidgetBridgeModule.kt`
- Create: `android/app/src/main/java/com/prayertimes/app/WidgetBridgePackage.kt`
- Modify: `android/app/src/main/java/com/prayertimes/app/MainApplication.kt`

- [ ] **Step 1: Create WidgetBridgeModule.kt**

Create `android/app/src/main/java/com/prayertimes/app/WidgetBridgeModule.kt`:

```kotlin
package com.prayertimes.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import com.facebook.react.bridge.*

class WidgetBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WidgetBridge"

    @ReactMethod
    fun setPrayerData(data: ReadableMap, promise: Promise) {
        try {
            val json = readableMapToJson(data)
            val prefs = reactApplicationContext.getSharedPreferences(
                "widget_prayer_data", Context.MODE_PRIVATE
            )
            prefs.edit().putString("prayerData", json).apply()
            broadcastWidgetUpdate()
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("WIDGET_BRIDGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun reloadAllTimelines(promise: Promise) {
        // No-op on Android — broadcastWidgetUpdate handles updates
        promise.resolve(null)
    }

    private fun broadcastWidgetUpdate() {
        val ctx = reactApplicationContext

        // Update NextPrayerWidget
        val nextIntent = Intent(ctx, NextPrayerWidget::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val ids = AppWidgetManager.getInstance(ctx)
                .getAppWidgetIds(ComponentName(ctx, NextPrayerWidget::class.java))
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        ctx.sendBroadcast(nextIntent)

        // Update CountdownWidget
        val countdownIntent = Intent(ctx, CountdownWidget::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            val ids = AppWidgetManager.getInstance(ctx)
                .getAppWidgetIds(ComponentName(ctx, CountdownWidget::class.java))
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        ctx.sendBroadcast(countdownIntent)
    }

    private fun readableMapToJson(map: ReadableMap): String {
        val gson = com.google.gson.Gson()
        val javaMap = map.toHashMap()
        return gson.toJson(javaMap)
    }
}
```

- [ ] **Step 2: Create WidgetBridgePackage.kt**

Create `android/app/src/main/java/com/prayertimes/app/WidgetBridgePackage.kt`:

```kotlin
package com.prayertimes.app

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class WidgetBridgePackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(WidgetBridgeModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

- [ ] **Step 3: Add Gson dependency**

Open `android/app/build.gradle` and add inside the `dependencies` block:

```gradle
implementation 'com.google.code.gson:gson:2.10.1'
```

- [ ] **Step 4: Register the package in MainApplication.kt**

Open `android/app/src/main/java/com/prayertimes/app/MainApplication.kt`.

Find the `getPackages()` method (it returns a list). Add `WidgetBridgePackage()` to the list:

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(WidgetBridgePackage())
    }
```

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java/com/prayertimes/app/WidgetBridgeModule.kt
git add android/app/src/main/java/com/prayertimes/app/WidgetBridgePackage.kt
git add android/app/build.gradle
git add android/app/src/main/java/com/prayertimes/app/MainApplication.kt
git commit -m "feat: add Android WidgetBridge native module"
```

---

## Task 8: Create Android widget resources

**Files:**
- Create: `android/app/src/main/res/drawable/widget_background.xml`
- Create: `android/app/src/main/res/layout/next_prayer_widget.xml`
- Create: `android/app/src/main/res/layout/countdown_widget.xml`
- Create: `android/app/src/main/res/xml/next_prayer_widget_info.xml`
- Create: `android/app/src/main/res/xml/countdown_widget_info.xml`

- [ ] **Step 1: Create background drawable**

Create `android/app/src/main/res/drawable/widget_background.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android"
    android:shape="rectangle">
    <solid android:color="#000000" />
    <corners android:radius="16dp" />
</shape>
```

- [ ] **Step 2: Create next prayer widget layout**

Create `android/app/src/main/res/layout/next_prayer_widget.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center"
    android:padding="16dp"
    android:background="@drawable/widget_background">

    <TextView
        android:id="@+id/widget_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="NEXT PRAYER"
        android:textColor="#4DFFFFFF"
        android:textSize="9sp"
        android:letterSpacing="0.2"
        android:textAllCaps="true"
        android:fontFamily="sans-serif-medium" />

    <TextView
        android:id="@+id/widget_prayer_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:text="Dhuhr"
        android:textColor="#FFFFFF"
        android:textSize="24sp"
        android:textStyle="bold"
        android:fontFamily="sans-serif" />

    <TextView
        android:id="@+id/widget_arabic_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:text="الظهر"
        android:textColor="#8CFFFFFF"
        android:textSize="13sp" />

    <TextView
        android:id="@+id/widget_prayer_time"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="10dp"
        android:text="12:10 PM"
        android:textColor="#C9A227"
        android:textSize="20sp"
        android:textStyle="bold"
        android:fontFamily="sans-serif-medium" />

</LinearLayout>
```

- [ ] **Step 3: Create countdown widget layout**

Create `android/app/src/main/res/layout/countdown_widget.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center"
    android:padding="16dp"
    android:background="@drawable/widget_background">

    <TextView
        android:id="@+id/countdown_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="TIME TO"
        android:textColor="#4DFFFFFF"
        android:textSize="9sp"
        android:letterSpacing="0.2"
        android:textAllCaps="true"
        android:fontFamily="sans-serif-medium" />

    <TextView
        android:id="@+id/countdown_prayer_name"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:text="Dhuhr"
        android:textColor="#C9A227"
        android:textSize="13sp"
        android:textStyle="bold" />

    <TextView
        android:id="@+id/countdown_time"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="1h 02m"
        android:textColor="#FFFFFF"
        android:textSize="32sp"
        android:textStyle="bold"
        android:fontFamily="sans-serif" />

    <TextView
        android:id="@+id/countdown_remaining_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:text="remaining"
        android:textColor="#4DFFFFFF"
        android:textSize="10sp" />

</LinearLayout>
```

- [ ] **Step 4: Create widget info XML files**

Create `android/app/src/main/res/xml/next_prayer_widget_info.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/next_prayer_widget"
    android:widgetCategory="home_screen"
    android:description="@string/app_name"
    android:resizeMode="horizontal|vertical" />
```

Create `android/app/src/main/res/xml/countdown_widget_info.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/countdown_widget"
    android:widgetCategory="home_screen"
    android:description="@string/app_name"
    android:resizeMode="horizontal|vertical" />
```

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/res/
git commit -m "feat: add Android widget XML resources and layouts"
```

---

## Task 9: Create Android widget Kotlin providers

**Files:**
- Create: `android/app/src/main/java/com/prayertimes/app/NextPrayerWidget.kt`
- Create: `android/app/src/main/java/com/prayertimes/app/CountdownWidget.kt`

- [ ] **Step 1: Create NextPrayerWidget.kt**

Create `android/app/src/main/java/com/prayertimes/app/NextPrayerWidget.kt`:

```kotlin
package com.prayertimes.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.widget.RemoteViews
import org.json.JSONObject
import java.util.*

class NextPrayerWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
    }

    companion object {
        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.next_prayer_widget)

            val prefs = context.getSharedPreferences("widget_prayer_data", Context.MODE_PRIVATE)
            val json = prefs.getString("prayerData", null)

            if (json != null) {
                try {
                    val data = JSONObject(json)
                    val nextIndex = data.getInt("nextPrayerIndex")
                    val prayers = data.getJSONArray("prayers")
                    val prayer = prayers.getJSONObject(nextIndex)

                    val name = prayer.getString("name")
                    val arabic = prayer.getString("arabicName")
                    val time = prayer.getString("time")

                    views.setTextViewText(R.id.widget_prayer_name, name)
                    views.setTextViewText(R.id.widget_arabic_name, arabic)
                    views.setTextViewText(R.id.widget_prayer_time, formatTime(time))
                } catch (e: Exception) {
                    views.setTextViewText(R.id.widget_prayer_name, "—")
                    views.setTextViewText(R.id.widget_arabic_name, "")
                    views.setTextViewText(R.id.widget_prayer_time, "Open app")
                }
            } else {
                views.setTextViewText(R.id.widget_prayer_name, "—")
                views.setTextViewText(R.id.widget_arabic_name, "")
                views.setTextViewText(R.id.widget_prayer_time, "Open app")
            }

            manager.updateAppWidget(widgetId, views)
        }

        private fun formatTime(time24: String): String {
            val parts = time24.split(":").mapNotNull { it.toIntOrNull() }
            if (parts.size < 2) return time24
            val h = parts[0]; val m = parts[1]
            val period = if (h >= 12) "PM" else "AM"
            val h12 = if (h == 0) 12 else if (h > 12) h - 12 else h
            return "%d:%02d %s".format(h12, m, period)
        }
    }
}
```

- [ ] **Step 2: Create CountdownWidget.kt**

Create `android/app/src/main/java/com/prayertimes/app/CountdownWidget.kt`:

```kotlin
package com.prayertimes.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews
import org.json.JSONObject

class CountdownWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (id in appWidgetIds) {
            updateWidget(context, appWidgetManager, id)
        }
        scheduleNextMinuteTick(context)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        // Handle the per-minute alarm tick
        if (intent.action == ACTION_TICK) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(
                android.content.ComponentName(context, CountdownWidget::class.java)
            )
            for (id in ids) {
                updateWidget(context, manager, id)
            }
            // Reschedule next tick only if widgets are still active
            if (ids.isNotEmpty()) {
                scheduleNextMinuteTick(context)
            }
        }
    }

    override fun onDisabled(context: Context) {
        cancelTick(context)
    }

    companion object {
        private const val ACTION_TICK = "com.prayertimes.app.COUNTDOWN_TICK"

        fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.countdown_widget)

            val prefs = context.getSharedPreferences("widget_prayer_data", Context.MODE_PRIVATE)
            val json = prefs.getString("prayerData", null)

            if (json != null) {
                try {
                    val data = JSONObject(json)
                    val nextIndex = data.getInt("nextPrayerIndex")
                    val prayers = data.getJSONArray("prayers")
                    val prayer = prayers.getJSONObject(nextIndex)
                    val name = prayer.getString("name")
                    val nextTimestamp = data.getLong("nextPrayerTimestamp")

                    val nowSec = System.currentTimeMillis() / 1000
                    val remaining = maxOf(0L, nextTimestamp - nowSec)
                    val h = remaining / 3600
                    val m = (remaining % 3600) / 60

                    val countdownText = if (h > 0) "%dh %02dm".format(h, m) else "%dm".format(m)

                    views.setTextViewText(R.id.countdown_prayer_name, name)
                    views.setTextViewText(R.id.countdown_time, countdownText)
                } catch (e: Exception) {
                    views.setTextViewText(R.id.countdown_prayer_name, "—")
                    views.setTextViewText(R.id.countdown_time, "--")
                }
            } else {
                views.setTextViewText(R.id.countdown_prayer_name, "—")
                views.setTextViewText(R.id.countdown_time, "Open app")
            }

            manager.updateAppWidget(widgetId, views)
        }

        fun scheduleNextMinuteTick(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = PendingIntent.getBroadcast(
                context, 0,
                Intent(context, CountdownWidget::class.java).apply { action = ACTION_TICK },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            val triggerAt = System.currentTimeMillis() + 60_000L
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
                !alarmManager.canScheduleExactAlarms()
            ) {
                // Fallback: inexact alarm (updates every ~15 min)
                alarmManager.set(AlarmManager.RTC, triggerAt, intent)
            } else {
                alarmManager.setExact(AlarmManager.RTC, triggerAt, intent)
            }
        }

        fun cancelTick(context: Context) {
            val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = PendingIntent.getBroadcast(
                context, 0,
                Intent(context, CountdownWidget::class.java).apply { action = ACTION_TICK },
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            alarmManager.cancel(intent)
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/java/com/prayertimes/app/NextPrayerWidget.kt
git add android/app/src/main/java/com/prayertimes/app/CountdownWidget.kt
git commit -m "feat: add Android AppWidget providers"
```

---

## Task 10: Register Android widgets in manifest

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: Add widget receivers and exact alarm permission**

Open `android/app/src/main/AndroidManifest.xml`.

Add `SCHEDULE_EXACT_ALARM` permission before the `<application>` tag:

```xml
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
```

Add both widget `<receiver>` entries inside the `<application>` tag, before the closing `</application>`:

```xml
<receiver
    android:name=".NextPrayerWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/next_prayer_widget_info" />
</receiver>

<receiver
    android:name=".CountdownWidget"
    android:exported="true">
    <intent-filter>
        <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
        <action android:name="com.prayertimes.app.COUNTDOWN_TICK" />
    </intent-filter>
    <meta-data
        android:name="android.appwidget.provider"
        android:resource="@xml/countdown_widget_info" />
</receiver>
```

- [ ] **Step 2: Commit**

```bash
git add android/app/src/main/AndroidManifest.xml
git commit -m "feat: register Android widget receivers in manifest"
```

---

## Task 11: Wire up the JS side

**Files:**
- Modify: `src/hooks/usePrayerTimes.ts`
- Modify: `App.tsx`

- [ ] **Step 1: Update usePrayerTimes.ts**

Open `src/hooks/usePrayerTimes.ts`. Add the following imports at the top:

```typescript
import { WidgetBridge } from '../modules/WidgetBridge';
import { buildWidgetPayload } from '../utils/widgetPayload';
```

Inside the `useEffect`, after `setData(result)` and before `setLoading(false)`, add:

```typescript
WidgetBridge.setPrayerData(buildWidgetPayload(result)).catch(() => {});
```

The modified section looks like:

```typescript
fetchPrayerTimes(latitude, longitude)
  .then((result) => {
    if (!cancelled) {
      setData(result);
      WidgetBridge.setPrayerData(buildWidgetPayload(result)).catch(() => {});
      setLoading(false);
    }
  })
```

- [ ] **Step 2: Update App.tsx to re-sync on foreground resume**

Open `App.tsx`. Add these imports:

```typescript
import { AppState, AppStateStatus } from 'react-native';
import { useRef, useEffect } from 'react';
```

Add a `WidgetSyncGate` component above the `App` default export:

```typescript
import { AppState, AppStateStatus } from 'react-native';
import { useRef, useEffect } from 'react';
import { WidgetBridge } from './src/modules/WidgetBridge';

function WidgetForegroundSync() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        WidgetBridge.reloadAllTimelines().catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return null;
}
```

Then add `<WidgetForegroundSync />` as the first child inside the `GestureHandlerRootView`:

```tsx
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WidgetForegroundSync />
      <SafeAreaProvider>
        {/* ... rest unchanged ... */}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePrayerTimes.ts App.tsx
git commit -m "feat: sync widget data after prayer times fetch and on foreground resume"
```

---

## Task 12: Build and verify

- [ ] **Step 1: Run iOS build**

```bash
npx expo run:ios
```

Expected: build succeeds, app launches in simulator.

- [ ] **Step 2: Test iOS widget**

On the simulator (or device):
1. Long-press home screen → `+` button → search "Prayer Times"
2. Both `Next Prayer` and `Prayer Countdown` widgets should appear
3. Add `Prayer Countdown` (small) — verify it shows a prayer name and countdown
4. Open the app → wait for prayer times to load → return to home screen
5. Confirm widget data updates (prayer name + time match the app)

- [ ] **Step 3: Run Android build**

```bash
npx expo run:android
```

Expected: build succeeds, app launches on emulator/device.

- [ ] **Step 4: Test Android widget**

On the emulator:
1. Long-press home screen → Widgets → find "Prayer Times" section
2. Add `Next Prayer` widget — verify it shows prayer name + time
3. Add `Prayer Countdown` widget — verify it shows countdown digits
4. Open the app → prayer times load → return home → widgets should update

- [ ] **Step 5: Verify exact alarm permission on Android 12+**

On Android 12+ device, go to Settings → Apps → Prayer Times → Alarms & Reminders → confirm the app has permission (required for per-minute countdown updates).

- [ ] **Step 6: Final commit**

```bash
git add .
git commit -m "feat: complete iOS and Android prayer widgets with countdown support"
```
