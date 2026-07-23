import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WidgetBridge } from '../modules/WidgetBridge';

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

/**
 * Per-prayer merge where `incoming` wins.
 *
 * The App Group copy is written on every toggle from either side, so it is never
 * staler than AsyncStorage — which makes it the right winner when the two differ.
 * Merging per prayer rather than per day keeps a widget check from dropping the
 * rest of that day's entries.
 */
function mergeLogs(base: PrayerLog, incoming: PrayerLog): PrayerLog {
  const merged: PrayerLog = { ...base };
  for (const [day, entries] of Object.entries(incoming)) {
    merged[day] = { ...(merged[day] ?? {}), ...entries };
  }
  return merged;
}

/* ── Provider ───────────────────────────────────────────────────────────── */

export function PrayerLogProvider({ children }: { children: React.ReactNode }) {
  const [log, setLog] = useState<PrayerLog>({});
  const appState = useRef(AppState.currentState);

  // Hydrate from local storage, then fold in anything checked off on a widget.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let stored: PrayerLog = {};
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) stored = JSON.parse(raw) as PrayerLog;
      } catch {
        // Corrupt or missing — start from whatever the App Group has.
      }

      const shared = await WidgetBridge.getPrayerLog();
      const merged = Object.keys(shared).length ? mergeLogs(stored, shared) : stored;

      if (cancelled) return;
      setLog(merged);

      // Seed the App Group on first run after upgrading, so existing history
      // shows up on the widgets instead of them starting blank.
      WidgetBridge.setPrayerLog(merged).catch(() => {});
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // Checks made on a widget land in the App Group while the app is backgrounded.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      const returning = appState.current.match(/inactive|background/) && next === 'active';
      appState.current = next;
      if (!returning) return;

      WidgetBridge.getPrayerLog()
        .then((shared) => {
          if (!Object.keys(shared).length) return;
          setLog((prev) => {
            const merged = mergeLogs(prev, shared);
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
            return merged;
          });
        })
        .catch(() => {});
    });

    return () => sub.remove();
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
        // Also refreshes the widgets, so a check in the app shows on the home screen.
        WidgetBridge.setPrayerLog(next).catch(() => {});
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
