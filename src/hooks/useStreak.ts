import { useMemo } from 'react';
import {
  usePrayerLogContext,
  STREAK_PRAYERS,
  PrayerLog,
} from '../context/PrayerLogContext';

/* ── Date helpers ───────────────────────────────────────────────────────── */

export function getDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return getDateString(d);
}

function isCompleteDay(log: PrayerLog, date: string): boolean {
  const day = log[date] ?? {};
  return STREAK_PRAYERS.every((p) => !!day[p]);
}

/* ── Streak calculation ─────────────────────────────────────────────────── */

function calcCurrentStreak(log: PrayerLog, today: string): number {
  let streak = 0;
  let date = isCompleteDay(log, today) ? today : shiftDate(today, -1);

  for (let i = 0; i < 3650; i++) {
    if (!isCompleteDay(log, date)) break;
    streak++;
    date = shiftDate(date, -1);
  }
  return streak;
}

function calcBestStreak(log: PrayerLog, today: string): number {
  const allDates = Object.keys(log)
    .filter((d) => d <= today)
    .sort();

  if (!allDates.length) return 0;

  let best = 0;
  let current = 0;
  let prev = '';

  for (const date of allDates) {
    // Reset if there's a gap between consecutive dates
    if (prev && shiftDate(prev, 1) !== date) current = 0;

    if (isCompleteDay(log, date)) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
    prev = date;
  }
  return best;
}

function calcTotalPrayers(log: PrayerLog): number {
  return Object.values(log).reduce((sum, day) => {
    return sum + STREAK_PRAYERS.filter((p) => !!day[p]).length;
  }, 0);
}

/* ── Grid data ──────────────────────────────────────────────────────────── */

export interface GridDay {
  date: string;
  count: number;   // 0–5
  isToday: boolean;
}

/** Returns exactly 35 days (5 weeks) ending today, oldest first */
function buildGrid(log: PrayerLog, today: string): GridDay[] {
  const days: GridDay[] = [];
  for (let i = 34; i >= 0; i--) {
    const date = shiftDate(today, -i);
    const day = log[date] ?? {};
    const count = STREAK_PRAYERS.filter((p) => !!day[p]).length;
    days.push({ date, count, isToday: date === today });
  }
  return days;
}

/* ── Motivational message ───────────────────────────────────────────────── */

export function streakMessage(streak: number): string {
  if (streak === 0) return 'Start your streak today!';
  if (streak < 3) return 'Great start, keep it up!';
  if (streak < 7) return 'You\'re building a habit!';
  if (streak < 14) return 'One week strong! 🌟';
  if (streak < 30) return 'Amazing consistency! ✨';
  if (streak < 60) return 'Mashallah! A whole month! 🏆';
  return 'Subhanallah! Legendary dedication! 💎';
}

/* ── Hook ───────────────────────────────────────────────────────────────── */

export interface StreakData {
  currentStreak: number;
  bestStreak: number;
  todayCount: number;
  totalPrayers: number;
  grid: GridDay[];
  today: string;
}

export function useStreak(): StreakData {
  const { log } = usePrayerLogContext();
  const today = getDateString();

  return useMemo(() => {
    const currentStreak = calcCurrentStreak(log, today);
    const bestStreak = calcBestStreak(log, today);
    const todayCount = STREAK_PRAYERS.filter((p) => !!(log[today]?.[p])).length;
    const totalPrayers = calcTotalPrayers(log);
    const grid = buildGrid(log, today);

    return { currentStreak, bestStreak, todayCount, totalPrayers, grid, today };
  }, [log, today]);
}
