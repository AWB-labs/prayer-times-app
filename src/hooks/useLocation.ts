import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { useLocationContext } from '../context/LocationContext';

export interface LocationState {
  latitude: number | null;
  longitude: number | null;
  cityName: string | null;
  loading: boolean;
  error: string | null;
  /** true when coordinates come from the user's manual pin, not GPS */
  isManual: boolean;
}

export function useLocation(): LocationState {
  const { manualLocation } = useLocationContext();

  const [gpsState, setGpsState] = useState<Omit<LocationState, 'isManual'>>({
    latitude: null,
    longitude: null,
    cityName: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // If manual location is set we don't need GPS at all
    if (manualLocation !== null) return;

    let cancelled = false;

    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (!cancelled) {
            setGpsState((prev) => ({
              ...prev,
              loading: false,
              error: 'Location permission denied. Please enable location access in settings.',
            }));
          }
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        const { latitude, longitude } = loc.coords;

        let cityName: string | null = null;
        try {
          const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
          cityName = address?.city || address?.region || address?.country || null;
        } catch {
          // Geocoding failed – city stays null
        }

        if (!cancelled) {
          setGpsState({ latitude, longitude, cityName, loading: false, error: null });
        }
      } catch {
        if (!cancelled) {
          setGpsState((prev) => ({
            ...prev,
            loading: false,
            error: 'Unable to get your location. Please check your GPS settings.',
          }));
        }
      }
    }

    getLocation();
    return () => { cancelled = true; };
  }, [manualLocation]);

  // Manual location takes priority
  if (manualLocation !== null) {
    return {
      latitude: manualLocation.latitude,
      longitude: manualLocation.longitude,
      cityName: manualLocation.cityName,
      loading: false,
      error: null,
      isManual: true,
    };
  }

  return { ...gpsState, isManual: false };
}
