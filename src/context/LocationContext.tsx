import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@manual_location';

export interface ManualLocation {
  latitude: number;
  longitude: number;
  cityName: string | null;
}

interface LocationContextValue {
  manualLocation: ManualLocation | null;
  /** Save a manually-picked location and persist it */
  setManualLocation: (loc: ManualLocation) => void;
  /** Revert to automatic GPS */
  clearManualLocation: () => void;
}

const LocationContext = createContext<LocationContextValue>({
  manualLocation: null,
  setManualLocation: () => {},
  clearManualLocation: () => {},
});

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [manualLocation, setManualLocationState] = useState<ManualLocation | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw) as ManualLocation;
          setManualLocationState(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const setManualLocation = useCallback((loc: ManualLocation) => {
    setManualLocationState(loc);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc)).catch(() => {});
  }, []);

  const clearManualLocation = useCallback(() => {
    setManualLocationState(null);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  return (
    <LocationContext.Provider
      value={{ manualLocation, setManualLocation, clearManualLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext(): LocationContextValue {
  return useContext(LocationContext);
}
