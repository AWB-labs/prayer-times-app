import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* ── Types ──────────────────────────────────────────────────────────────── */

/** The 5 obligatory daily prayers that count toward the streak */
export const STREAK_PRAYERS = [
  'Fajr',
  'Dhuhr',
  'Asr',
  'Maghrib',
  'Isha',
] as const;

export type StreakPrayerName = (typeof STREAK_PRAYERS)[number];

/** Per-day record of which prayers were completed */
export type DayLog = Partial<Record<StreakPrayerName, boolean>>;

/** Full log keyed by "YYYY-MM-DD" */
export type PrayerLog = Record<string, DayLog>;

/* ── Context ────────────────────────────────────────────────────────────── */

interface PrayerLogContextValue {
  log: PrayerLog;
  togglePrayer: (date: string, prayer: StreakPrayerName) => void;
  isPrayerDone: (date: string, prayer: StreakPrayerName) => boolean;
}

const PrayerLogContext = createContext<PrayerLogContextValue>({
  log: {},
  togglePrayer: () => {},
  isPrayerDone: () => false,
});

const STORAGE_KEY = '@prayer_log_v1';

/* ── Provider ───────────────────────────────────────────────────────────── */

export function PrayerLogProvider({ children }: { children: React.ReactNode }) {
  const [log, setLog] = useState<PrayerLog>({});

  // Load from storage on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setLog(JSON.parse(raw) as PrayerLog);
      })
      .catch(() => {});
  }, []);

  const togglePrayer = useCallback(
    (date: string, prayer: StreakPrayerName) => {
      setLog((prev) => {
        const day = prev[date] ?? {};
        const next: PrayerLog = {
          ...prev,
          [date]: { ...day, [prayer]: !day[prayer] },
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    []
  );

  const isPrayerDone = useCallback(
    (date: string, prayer: StreakPrayerName): boolean => {
      return !!(log[date]?.[prayer]);
    },
    [log]
  );

  return (
    <PrayerLogContext.Provider value={{ log, togglePrayer, isPrayerDone }}>
      {children}
    </PrayerLogContext.Provider>
  );
}

export function usePrayerLogContext(): PrayerLogContextValue {
  return useContext(PrayerLogContext);
}
