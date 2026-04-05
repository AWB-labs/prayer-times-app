import { Platform } from 'react-native';

import { PrayerData, PrayerName } from '../types';
import { NotificationPrefs, NotificationMode } from '../context/NotificationPrefsContext';
import { StreakPrayerName } from '../context/PrayerLogContext';

const PRAYER_KEYS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

const ARABIC_NAMES: Record<PrayerName, string> = {
  Fajr: 'الفجر',
  Sunrise: 'الشروق',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

const BEFORE_MINUTES = 10;
const AFTER_MINUTES = 8;

function parseTimeToDate(day: Date, timeStr: string): Date {
  const clean = timeStr.split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60 * 1000);
}

function androidChannelForMode(mode: NotificationMode): string {
  if (mode === 'sound') return 'prayer-sound';
  if (mode === 'vibration') return 'prayer-vibration';
  return 'prayer-silent';
}

interface ScheduleItem {
  date: Date;
  title: string;
  body: string;
  mode: NotificationMode;
}

export async function schedulePrayerNotifications(
  Notifications: typeof import('expo-notifications'),
  today: PrayerData,
  tomorrow: PrayerData,
  prefs: NotificationPrefs
): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prayer-sound', {
      name: 'Prayer reminders (sound)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync('prayer-silent', {
      name: 'Prayer reminders (silent)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: undefined,
      enableVibrate: false,
    });
    await Notifications.setNotificationChannelAsync('prayer-vibration', {
      name: 'Prayer reminders (vibration)',
      importance: Notifications.AndroidImportance.HIGH,
      sound: undefined,
      vibrationPattern: [0, 400, 200, 400],
      enableVibrate: true,
    });
  }

  const now = Date.now();
  const items: ScheduleItem[] = [];

  const todayDate = new Date();
  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  function collectForDay(day: Date, prayerData: PrayerData) {
    for (const key of PRAYER_KEYS) {
      const mode: NotificationMode = prefs.prayers[key as StreakPrayerName];
      if (mode === 'off') continue;

      const prayerTime = parseTimeToDate(day, prayerData.timings[key]);
      const ar = ARABIC_NAMES[key];

      if (prefs.athkarEnabled) {
        items.push({
          date: addMinutes(prayerTime, -BEFORE_MINUTES),
          title: 'ذكر الله قبل الصلاة',
          body: `تذكير لقول الأذكار قبل صلاة ${ar}`,
          mode,
        });
      }

      items.push({
        date: prayerTime,
        title: `حان وقت صلاة ${ar}`,
        body: 'حي على الصلاة — افتح التطبيق لعرض الأوقات',
        mode,
      });

      if (prefs.athkarEnabled) {
        items.push({
          date: addMinutes(prayerTime, AFTER_MINUTES),
          title: 'أذكار بعد الصلاة',
          body: `تذكير لقول أذكار ما بعد الصلاة — ${ar}`,
          mode,
        });
      }
    }
  }

  collectForDay(todayDate, today);
  collectForDay(tomorrowDate, tomorrow);

  for (const s of items) {
    if (s.date.getTime() <= now) continue;

    const withSound = s.mode === 'sound';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: s.title,
        body: s.body,
        sound: withSound ? 'default' : undefined,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: s.date,
        ...(Platform.OS === 'android'
          ? { channelId: androidChannelForMode(s.mode) }
          : {}),
      },
    });
  }
}
