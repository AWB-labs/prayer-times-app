import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import type { WidgetPayload } from '../utils/widgetPayload';

interface NativeWidgetBridge {
  setPrayerData(data: WidgetPayload): Promise<void>;
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

  /** iOS only: forces WidgetKit to immediately re-fetch all timelines. */
  async reloadAllTimelines(): Promise<void> {
    if (!Native || Platform.OS !== 'ios') return;
    return Native.reloadAllTimelines();
  },
};
