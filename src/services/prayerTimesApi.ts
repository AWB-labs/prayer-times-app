import { ApiResponse, PrayerData } from '../types';
import { CalculationConfig, resolveCalculationConfig } from './calculationMethod';
import { getCountryCode } from './locationCountry';

const BASE_URL = 'https://api.aladhan.com/v1';

export { CALCULATION_METHODS, SCHOOL } from './calculationMethod';

/**
 * Fetch prayer times for a location.
 *
 * The calculation convention is derived from the coordinates rather than being
 * fixed globally, so users see the same Fajr/Isha/Asr their local mosques use.
 * Resolution happens here so that every caller — the home screen, the
 * notification scheduler and the widget — is guaranteed to share one config.
 *
 * @param config Overrides the automatic convention. Intended for tests.
 */
export async function fetchPrayerTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
  config?: CalculationConfig
): Promise<PrayerData> {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  const resolved =
    config ??
    resolveCalculationConfig(
      latitude,
      longitude,
      await getCountryCode(latitude, longitude)
    );

  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    method: String(resolved.method),
    school: String(resolved.school),
  });

  if (resolved.latitudeAdjustmentMethod !== undefined) {
    params.set('latitudeAdjustmentMethod', String(resolved.latitudeAdjustmentMethod));
  }

  const response = await fetch(`${BASE_URL}/timings/${dateStr}?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch prayer times: ${response.status}`);
  }

  const json: ApiResponse = await response.json();

  if (json.code !== 200) {
    throw new Error(`API error: ${json.status}`);
  }

  return json.data;
}
