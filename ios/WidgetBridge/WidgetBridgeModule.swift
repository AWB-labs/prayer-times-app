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
