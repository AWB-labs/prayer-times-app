import { useState, useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { Magnetometer } from 'expo-sensors';

import { fetchQiblaDirection } from '../services/qiblaApi';

export interface QiblaState {
  /** Qibla bearing from North (0-360), null while loading */
  qiblaBearing: number | null;
  /** Device heading from magnetic north (0-360) */
  deviceHeading: number;
  /** Rotation angle the compass needle should render at, in degrees */
  needleAngle: number;
  loading: boolean;
  error: string | null;
  /** Whether the device magnetometer is available */
  sensorAvailable: boolean;
  /** Animated value driving the needle rotation (use with Animated.View) */
  needleAnim: Animated.Value;
}

function computeHeading(x: number, y: number): number {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  angle = 90 - angle;
  if (angle < 0) angle += 360;
  return angle % 360;
}

export function useQibla(
  latitude: number | null,
  longitude: number | null
): QiblaState {
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sensorAvailable, setSensorAvailable] = useState(true);

  const needleAnim = useRef(new Animated.Value(0)).current;
  const lastAngle = useRef(0);

  // Fetch Qibla direction from API
  useEffect(() => {
    if (latitude === null || longitude === null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchQiblaDirection(latitude, longitude)
      .then((data) => {
        if (!cancelled) {
          setQiblaBearing(data.direction);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch Qibla direction');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [latitude, longitude]);

  // Subscribe to magnetometer
  useEffect(() => {
    let subscription: ReturnType<typeof Magnetometer.addListener> | null = null;

    Magnetometer.isAvailableAsync().then((available) => {
      setSensorAvailable(available);
      if (!available) return;

      Magnetometer.setUpdateInterval(150);
      subscription = Magnetometer.addListener(({ x, y }) => {
        setDeviceHeading(computeHeading(x, y));
      });
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  // Animate the needle whenever bearing or heading changes
  const needleAngle = qiblaBearing !== null ? qiblaBearing - deviceHeading : 0;

  useEffect(() => {
    // Shortest-path rotation to avoid spinning the wrong way
    let delta = needleAngle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const next = lastAngle.current + delta;
    lastAngle.current = next;

    Animated.spring(needleAnim, {
      toValue: next,
      useNativeDriver: true,
      friction: 6,
      tension: 40,
    }).start();
  }, [needleAngle, needleAnim]);

  return {
    qiblaBearing,
    deviceHeading,
    needleAngle,
    loading,
    error,
    sensorAvailable,
    needleAnim,
  };
}
