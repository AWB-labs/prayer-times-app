import { Prayer, PrayerName, PrayerTimings } from '../types';

// `icon` values are MaterialCommunityIcons glyph names (from @expo/vector-icons).
export const PRAYER_CONFIG: { name: PrayerName; arabicName: string; icon: string }[] = [
  { name: 'Fajr', arabicName: 'الفجر', icon: 'weather-sunset-up' },
  { name: 'Sunrise', arabicName: 'الشروق', icon: 'weather-sunny' },
  { name: 'Dhuhr', arabicName: 'الظهر', icon: 'white-balance-sunny' },
  { name: 'Asr', arabicName: 'العصر', icon: 'weather-partly-cloudy' },
  { name: 'Maghrib', arabicName: 'المغرب', icon: 'weather-sunset-down' },
  { name: 'Isha', arabicName: 'العشاء', icon: 'weather-night' },
];

export function buildPrayerList(timings: PrayerTimings): Prayer[] {
  return PRAYER_CONFIG.map((config) => ({
    ...config,
    // Strip the timezone offset suffix e.g. "05:03 (+03)"
    time: timings[config.name].split(' ')[0],
  }));
}

export function timeToMinutes(timeStr: string): number {
  const clean = timeStr.split(' ')[0];
  const [h, m] = clean.split(':').map(Number);
  return h * 60 + m;
}

export function getCurrentAndNextPrayer(prayers: Prayer[]): {
  currentIndex: number;
  nextIndex: number;
} {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Find the last prayer whose time has passed
  let currentIndex = -1;
  for (let i = 0; i < prayers.length; i++) {
    if (timeToMinutes(prayers[i].time) <= currentMinutes) {
      currentIndex = i;
    }
  }

  const nextIndex =
    currentIndex === prayers.length - 1 ? 0 : currentIndex + 1;

  return { currentIndex, nextIndex };
}

export function getTimeUntilNextPrayer(nextPrayerTime: string): string {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const nextMinutes = timeToMinutes(nextPrayerTime);

  let diff = nextMinutes - currentMinutes;
  if (diff < 0) diff += 24 * 60; // wrap around midnight

  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/** Returns second-precision countdown data plus a 0–1 progress fraction.
 *  progress = fraction of the prayer interval that has elapsed
 *  (0 = just after previous prayer, 1 = next prayer time reached) */
export function getCountdownData(
  prayers: Prayer[],
  nextIndex: number
): { hours: number; minutes: number; seconds: number; progress: number } {
  const now = new Date();
  const nowSeconds =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  function toSeconds(t: string): number {
    const [h, m] = t.split(':').map(Number);
    return h * 3600 + m * 60;
  }

  const nextSec = toSeconds(prayers[nextIndex].time);
  let remaining = nextSec - nowSeconds;
  if (remaining < 0) remaining += 86400; // wrap midnight

  // Interval from previous prayer to next prayer
  const prevIndex = nextIndex === 0 ? prayers.length - 1 : nextIndex - 1;
  const prevSec = toSeconds(prayers[prevIndex].time);
  let interval = nextSec - prevSec;
  if (interval <= 0) interval += 86400;

  const elapsed = interval - remaining;
  const progress = Math.min(1, Math.max(0, elapsed / interval));

  return {
    hours: Math.floor(remaining / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    progress,
  };
}

export function formatTo12Hour(time24: string): string {
  const [hourStr, minuteStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const minute = minuteStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}
