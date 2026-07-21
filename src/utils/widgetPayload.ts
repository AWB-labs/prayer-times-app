import { PrayerData, PrayerName } from '../types';
import { buildPrayerList } from './prayerUtils';

export interface WidgetPrayer {
  name: PrayerName;
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
function prayerTimeToTimestamp(timeStr: string, baseDate: Date): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const d = new Date(baseDate);
  d.setHours(hours, minutes, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

function todayDateString(baseDate: Date): string {
  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildWidgetPayload(prayerData: PrayerData): WidgetPayload {
  const baseDate = new Date();
  const now = Math.floor(baseDate.getTime() / 1000);
  const prayers = buildPrayerList(prayerData.timings);

  const widgetPrayers: WidgetPrayer[] = prayers.map((p) => ({
    name: p.name,
    arabicName: p.arabicName,
    time: p.time,
    timestamp: prayerTimeToTimestamp(p.time, baseDate),
  }));

  // First prayer whose timestamp is still in the future
  let nextPrayerIndex = widgetPrayers.findIndex((p) => p.timestamp > now);
  let nextPrayerTimestamp: number;

  if (nextPrayerIndex === -1) {
    // All of today's prayers have passed → wrap to tomorrow's Fajr. Without the
    // day offset the countdown target would sit in the past and read as 0.
    nextPrayerIndex = 0;
    nextPrayerTimestamp = widgetPrayers[0].timestamp + 86400;
  } else {
    nextPrayerTimestamp = widgetPrayers[nextPrayerIndex].timestamp;
  }

  return {
    prayers: widgetPrayers,
    nextPrayerIndex,
    nextPrayerName: widgetPrayers[nextPrayerIndex].name,
    nextPrayerTimestamp,
    date: todayDateString(baseDate),
  };
}
