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
