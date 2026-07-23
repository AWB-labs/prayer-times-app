import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { WidgetPayload } from '../utils/widgetPayload';
import type { PrayerLog } from '../context/PrayerLogContext';

interface NativeWidgetBridge {
  setPrayerData(data: WidgetPayload): Promise<void>;
  setPrayerLog(log: PrayerLog): Promise<void>;
  getPrayerLog(): Promise<PrayerLog>;
  reloadAllTimelines(): Promise<void>;
}

// Registered natively only on iOS (see modules/widget-bridge). Returns null on
// platforms where the module isn't built, so all calls below no-op safely.
const Native = requireOptionalNativeModule<NativeWidgetBridge>('WidgetBridge');

export const WidgetBridge = {
  /** Writes prayer data to shared storage and reloads widget timelines. */
  async setPrayerData(data: WidgetPayload): Promise<void> {
    if (!Native) return;
    return Native.setPrayerData(data);
  },

  /** Mirrors the completion log into the App Group the widgets read from. */
  async setPrayerLog(log: PrayerLog): Promise<void> {
    if (!Native) return;
    return Native.setPrayerLog(log);
  },

  /**
   * Reads the shared log back, picking up any prayers checked off on a widget
   * while the app was backgrounded. Resolves to `{}` when nothing is stored.
   */
  async getPrayerLog(): Promise<PrayerLog> {
    if (!Native) return {};
    try {
      return (await Native.getPrayerLog()) ?? {};
    } catch {
      return {};
    }
  },

  /** iOS only: forces WidgetKit to immediately re-fetch all timelines. */
  async reloadAllTimelines(): Promise<void> {
    if (!Native || Platform.OS !== 'ios') return;
    return Native.reloadAllTimelines();
  },
};
