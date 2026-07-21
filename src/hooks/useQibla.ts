import { useState, useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';

/** Kaaba, Masjid al-Haram. */
const KAABA_LAT = 21.4224779;
const KAABA_LON = 39.8261818;

/** Turns green within this many degrees, and only lets go past the exit angle. */
const ALIGN_ENTER_DEG = 5;
const ALIGN_EXIT_DEG = 8;

/** Low-pass factor applied to each reading — lower is steadier but laggier. */
const SMOOTHING = 0.25;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Great-circle initial bearing from a coordinate to the Kaaba, in degrees
 * clockwise from **true** north. Same spherical formula the AlAdhan endpoint
 * uses, but it needs no network, so the compass works offline and without the
 * loading/error states a fetch drags in.
 */
export function computeQiblaBearing(latitude: number, longitude: number): number {
  const phi1 = toRad(latitude);
  const phi2 = toRad(KAABA_LAT);
  const deltaLambda = toRad(KAABA_LON - longitude);

  const y = Math.sin(deltaLambda);
  const x = Math.cos(phi1) * Math.tan(phi2) - Math.sin(phi1) * Math.cos(deltaLambda);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Signed difference a − b, wrapped to (−180, 180]. */
function angleDelta(a: number, b: number): number {
  return ((a - b + 540) % 360) - 180;
}

export interface QiblaState {
  /** Qibla bearing from true north (0–360), null until coordinates arrive. */
  qiblaBearing: number | null;
  /** Where the top of the device points, in whole degrees. */
  deviceHeading: number;
  /** Whether the device is currently pointed at the Qibla (with hysteresis). */
  isAligned: boolean;
  /** True when the heading is referenced to true north rather than magnetic. */
  isTrueNorth: boolean;
  /** Compass calibration, 0 (unusable) to 3 (high). Null before the first reading. */
  accuracy: number | null;
  loading: boolean;
  error: string | null;
  /** Whether this device can track heading at all. */
  sensorAvailable: boolean;
  /**
   * Accumulated device heading in degrees, unwrapped so it never jumps at the
   * 0/360 seam. Both the needle and the cardinal ring derive their rotation
   * from this single value, which keeps them rigidly in step.
   */
  headingAnim: Animated.Value;
}

export function useQibla(
  latitude: number | null,
  longitude: number | null
): QiblaState {
  const [qiblaBearing, setQiblaBearing] = useState<number | null>(null);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [isAligned, setIsAligned] = useState(false);
  const [isTrueNorth, setIsTrueNorth] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sensorAvailable, setSensorAvailable] = useState(true);

  const headingAnim = useRef(new Animated.Value(0)).current;

  // Read inside the sensor callback, which is subscribed once and must not go
  // stale when the bearing or alignment changes.
  const bearingRef = useRef<number | null>(null);
  const smoothedRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const reportedRef = useRef<number | null>(null);
  const alignedRef = useRef(false);
  const accuracyRef = useRef<number | null>(null);
  const trueNorthRef = useRef<boolean | null>(null);

  // Qibla bearing is pure geometry — no fetch, so it lands with the coordinates.
  useEffect(() => {
    if (latitude === null || longitude === null) {
      bearingRef.current = null;
      setQiblaBearing(null);
      return;
    }
    const bearing = computeQiblaBearing(latitude, longitude);
    bearingRef.current = bearing;
    setQiblaBearing(bearing);
  }, [latitude, longitude]);

  useEffect(() => {
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    let positionSubscription: Location.LocationSubscription | null = null;

    async function subscribe() {
      try {
        // expo-location has no heading-capability probe of its own.
        const available = await Magnetometer.isAvailableAsync();
        if (cancelled) return;
        if (!available) {
          setSensorAvailable(false);
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setError('Location permission is needed to read the compass.');
          return;
        }

        // CLHeading.trueHeading is documented as invalid "if location updates are
        // not currently being generated", and expo's heading watch only ever calls
        // startUpdatingHeading. Android likewise can't build the GeomagneticField
        // it derives declination from until a fix lands. Without an active watch
        // both platforms hand back -1, we fall back to magnetic north, and the
        // local declination silently becomes a compass error — which is exactly
        // what true north exists to remove.
        //
        // The positions themselves are deliberately unused: this subscription is
        // here to keep a fix alive so the OS can resolve declination for us.
        positionSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 50 },
          () => {}
        );
        if (cancelled) return;

        // watchHeadingAsync is backed by CLLocationManager on iOS and the fused
        // rotation-vector sensor on Android. Both are tilt-compensated and
        // OS-calibrated, unlike raw magnetometer x/y, which is only meaningful
        // when the phone lies perfectly flat.
        subscription = await Location.watchHeadingAsync((reading) => {
          if (cancelled) return;

          // trueHeading is -1 where the device can't resolve declination.
          const usesTrueNorth = reading.trueHeading >= 0;
          const raw = usesTrueNorth ? reading.trueHeading : reading.magHeading;
          if (typeof raw !== 'number' || Number.isNaN(raw)) return;

          if (trueNorthRef.current !== usesTrueNorth) {
            trueNorthRef.current = usesTrueNorth;
            setIsTrueNorth(usesTrueNorth);
          }

          // Guard the NaN case: NaN !== NaN would setState on every reading.
          const level =
            typeof reading.accuracy === 'number' && !Number.isNaN(reading.accuracy)
              ? Math.round(reading.accuracy)
              : null;
          if (accuracyRef.current !== level) {
            accuracyRef.current = level;
            setAccuracy(level);
          }

          const previous = smoothedRef.current;
          let smoothed: number;

          if (previous === null) {
            // Land on the first reading instead of sweeping up from zero.
            smoothed = raw;
            accumulatedRef.current = raw;
            headingAnim.setValue(raw);
          } else {
            smoothed = (previous + angleDelta(raw, previous) * SMOOTHING + 360) % 360;
            // Unwrap, so a 359° → 1° step turns 2° forward rather than 358° back.
            accumulatedRef.current += angleDelta(smoothed, previous);

            Animated.timing(headingAnim, {
              toValue: accumulatedRef.current,
              duration: 120,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }).start();
          }

          smoothedRef.current = smoothed;

          // Re-render only when the whole-degree readout actually moves; the
          // rotation itself is driven natively off headingAnim.
          const rounded = Math.round(smoothed) % 360;
          if (reportedRef.current !== rounded) {
            reportedRef.current = rounded;
            setDeviceHeading(rounded);
          }

          const bearing = bearingRef.current;
          if (bearing !== null) {
            const off = Math.abs(angleDelta(bearing, smoothed));
            const shouldFlip = alignedRef.current
              ? off > ALIGN_EXIT_DEG
              : off < ALIGN_ENTER_DEG;
            if (shouldFlip) {
              alignedRef.current = !alignedRef.current;
              setIsAligned(alignedRef.current);
            }
          }
        });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not start the compass.');
        }
      }
    }

    subscribe();

    return () => {
      cancelled = true;
      subscription?.remove();
      positionSubscription?.remove();
    };
  }, [headingAnim]);

  return {
    qiblaBearing,
    deviceHeading,
    isAligned,
    isTrueNorth,
    accuracy,
    loading: latitude === null || longitude === null,
    error,
    sensorAvailable,
    headingAnim,
  };
}
