import ExpoModulesCore
import WidgetKit

private let appGroup = "group.com.badry.prayertimes"

public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    AsyncFunction("setPrayerData") { (data: [String: Any], promise: Promise) in
      do {
        let jsonData = try JSONSerialization.data(withJSONObject: data, options: [])
        let defaults = UserDefaults(suiteName: appGroup)
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

    // The app keeps its completion log in AsyncStorage, which the widget process
    // cannot read. Mirroring it into the App Group is what lets the checklist
    // widget render checkmarks — and, through TogglePrayerIntent, write them.
    AsyncFunction("setPrayerLog") { (log: [String: Any], promise: Promise) in
      do {
        let jsonData = try JSONSerialization.data(withJSONObject: log, options: [])
        let defaults = UserDefaults(suiteName: appGroup)
        defaults?.set(jsonData, forKey: "prayerLog")
        defaults?.synchronize()
        if #available(iOS 14.0, *) {
          WidgetCenter.shared.reloadAllTimelines()
        }
        promise.resolve(nil)
      } catch {
        promise.reject("WIDGET_BRIDGE_ERROR", error.localizedDescription)
      }
    }

    // Reads the log back so the app can pick up checks made on a widget while it
    // was backgrounded. Returns an empty object when nothing has been written yet,
    // which the caller treats as "no shared state, keep what's in AsyncStorage".
    AsyncFunction("getPrayerLog") { (promise: Promise) in
      guard
        let defaults = UserDefaults(suiteName: appGroup),
        let data = defaults.data(forKey: "prayerLog"),
        let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      else {
        promise.resolve([String: Any]())
        return
      }
      promise.resolve(parsed)
    }

    AsyncFunction("reloadAllTimelines") { (promise: Promise) in
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
      promise.resolve(nil)
    }
  }
}
