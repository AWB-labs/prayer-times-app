import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StreakPrayerName, STREAK_PRAYERS } from './PrayerLogContext';

export type NotificationMode = 'off' | 'silent' | 'vibration' | 'sound';

export interface NotificationPrefs {
  prayers: Record<StreakPrayerName, NotificationMode>;
  athkarEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  prayers: {
    Fajr: 'sound',
    Dhuhr: 'sound',
    Asr: 'sound',
    Maghrib: 'sound',
    Isha: 'sound',
  },
  athkarEnabled: true,
};

interface NotificationPrefsContextValue {
  prefs: NotificationPrefs;
  setPrayerMode: (prayer: StreakPrayerName, mode: NotificationMode) => void;
  setAthkarEnabled: (enabled: boolean) => void;
}

const NotificationPrefsContext = createContext<NotificationPrefsContextValue>({
  prefs: DEFAULT_PREFS,
  setPrayerMode: () => {},
  setAthkarEnabled: () => {},
});

const STORAGE_KEY = '@notification_prefs_v1';

export function NotificationPrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw) as Partial<NotificationPrefs>;
          setPrefs((prev) => ({
            prayers: { ...prev.prayers, ...(saved.prayers ?? {}) },
            athkarEnabled: saved.athkarEnabled ?? prev.athkarEnabled,
          }));
        }
      })
      .catch(() => {});
  }, []);

  const persist = useCallback((next: NotificationPrefs) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const setPrayerMode = useCallback((prayer: StreakPrayerName, mode: NotificationMode) => {
    setPrefs((prev) => {
      const next: NotificationPrefs = {
        ...prev,
        prayers: { ...prev.prayers, [prayer]: mode },
      };
      persist(next);
      return next;
    });
  }, [persist]);

  const setAthkarEnabled = useCallback((enabled: boolean) => {
    setPrefs((prev) => {
      const next: NotificationPrefs = { ...prev, athkarEnabled: enabled };
      persist(next);
      return next;
    });
  }, [persist]);

  return (
    <NotificationPrefsContext.Provider value={{ prefs, setPrayerMode, setAthkarEnabled }}>
      {children}
    </NotificationPrefsContext.Provider>
  );
}

export function useNotificationPrefs(): NotificationPrefsContextValue {
  return useContext(NotificationPrefsContext);
}

export { STREAK_PRAYERS };
