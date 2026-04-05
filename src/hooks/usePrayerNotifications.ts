import { useEffect } from 'react';
import { Platform } from 'react-native';

import { PrayerData } from '../types';
import { fetchPrayerTimes } from '../services/prayerTimesApi';
import { schedulePrayerNotifications } from '../utils/prayerNotifications';
import { useNotificationPrefs } from '../context/NotificationPrefsContext';

export function usePrayerNotifications(
  latitude: number | null,
  longitude: number | null,
  todayData: PrayerData | null
): void {
  const { prefs } = useNotificationPrefs();

  useEffect(() => {
    if (latitude === null || longitude === null || !todayData) return;

    let cancelled = false;

    void (async () => {
      try {
        const Notifications = await import('expo-notifications');

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          if (status !== 'granted' || cancelled) return;
        }

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('prayer', {
            name: 'Prayer reminders',
            importance: Notifications.AndroidImportance.HIGH,
          });
        }

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowData = await fetchPrayerTimes(latitude, longitude, tomorrow);
        if (cancelled) return;

        await schedulePrayerNotifications(Notifications, todayData, tomorrowData, prefs);
      } catch (e) {
        if (__DEV__) {
          console.warn('[prayer-times] Notifications error:', e);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, todayData, prefs]);
}
