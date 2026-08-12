import * as Location from 'expo-location';

/**
 * Resolves an ISO country code from coordinates, used to pick the Asr school.
 *
 * Results are cached per rounded coordinate: the country only matters at
 * country scale, so ~11 km of precision is plenty, and this keeps the prayer
 * times and the notification scheduler from each hitting the geocoder.
 */
const cache = new Map<string, string | null>();

const keyFor = (latitude: number, longitude: number) =>
  `${latitude.toFixed(1)},${longitude.toFixed(1)}`;

export async function getCountryCode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const key = keyFor(latitude, longitude);

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let code: string | null = null;
  try {
    const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
    code = address?.isoCountryCode ?? null;
  } catch {
    // Geocoder unavailable or offline — the caller falls back to the
    // standard Asr school, which is the majority convention worldwide.
  }

  cache.set(key, code);
  return code;
}
