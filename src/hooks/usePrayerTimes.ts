import { useState, useEffect } from 'react';
import { PrayerData } from '../types';
import { fetchPrayerTimes } from '../services/prayerTimesApi';
import { WidgetBridge } from '../modules/WidgetBridge';
import { buildWidgetPayload } from '../utils/widgetPayload';

interface PrayerTimesState {
  data: PrayerData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePrayerTimes(
  latitude: number | null,
  longitude: number | null
): PrayerTimesState {
  const [data, setData] = useState<PrayerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (latitude === null || longitude === null) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPrayerTimes(latitude, longitude)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          WidgetBridge.setPrayerData(buildWidgetPayload(result)).catch(() => {});
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load prayer times');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude, trigger]);

  const refetch = () => setTrigger((t) => t + 1);

  return { data, loading, error, refetch };
}
