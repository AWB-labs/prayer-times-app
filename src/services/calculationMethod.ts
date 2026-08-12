/**
 * Auto-selects the prayer calculation convention from the user's location.
 *
 * Sunrise/Dhuhr/Maghrib are pure astronomy and identical everywhere. The
 * complaints about times being "off by a few minutes" are always Fajr, Isha or
 * Asr, which are juristic conventions that vary by region — so we pick the
 * convention the user's local mosques actually use instead of one global default.
 */

/** Aladhan `method` ids. See https://aladhan.com/calculation-methods */
export const CALCULATION_METHODS = {
  JAFARI: 0,
  KARACHI: 1,
  ISNA: 2,
  MWL: 3,
  MAKKAH: 4,
  EGYPT: 5,
  TEHRAN: 7,
  GULF: 8,
  KUWAIT: 9,
  QATAR: 10,
  SINGAPORE: 11,
  FRANCE: 12,
  TURKEY: 13,
  RUSSIA: 14,
  DUBAI: 16,
  MALAYSIA: 17,
  TUNISIA: 18,
  ALGERIA: 19,
  INDONESIA: 20,
  MOROCCO: 21,
  PORTUGAL: 22,
  JORDAN: 23,
} as const;

/** Asr shadow ratio. Aladhan `school`: 0 = Shafi/Maliki/Hanbali, 1 = Hanafi. */
export const SCHOOL = { STANDARD: 0, HANAFI: 1 } as const;

/**
 * Aladhan `latitudeAdjustmentMethod`: 3 = Angle Based, the rule for places
 * where the sun never dips far enough for a true Fajr/Isha.
 *
 * This is already Aladhan's default, so sending it changes no current time. It
 * is sent explicitly to pin the behaviour: these are worship times, and they
 * should not shift because an upstream default changed.
 */
const ANGLE_BASED = 3;

/** Latitude beyond which summer nights break the standard twilight angles. */
const HIGH_LATITUDE_THRESHOLD = 48;

/**
 * Anchor points for each regional authority, taken from the `location` field
 * that Aladhan returns on /v1/methods. A user is assigned the authority whose
 * anchor is nearest, which needs no country database and no maintenance.
 */
interface Anchor {
  method: number;
  lat: number;
  lon: number;
}

const ANCHORS: Anchor[] = [
  { method: CALCULATION_METHODS.MWL, lat: 51.52, lon: -0.14 }, // London
  { method: CALCULATION_METHODS.ISNA, lat: 39.7, lon: -86.4 }, // Indiana
  { method: CALCULATION_METHODS.EGYPT, lat: 30.04, lon: 31.24 }, // Cairo
  { method: CALCULATION_METHODS.MAKKAH, lat: 21.39, lon: 39.86 }, // Makkah
  { method: CALCULATION_METHODS.KARACHI, lat: 24.86, lon: 67.01 }, // Karachi
  { method: CALCULATION_METHODS.GULF, lat: 24.13, lon: 53.32 }, // Abu Dhabi
  { method: CALCULATION_METHODS.KUWAIT, lat: 29.38, lon: 47.98 }, // Kuwait City
  { method: CALCULATION_METHODS.QATAR, lat: 25.29, lon: 51.53 }, // Doha
  { method: CALCULATION_METHODS.SINGAPORE, lat: 1.35, lon: 103.82 }, // Singapore
  { method: CALCULATION_METHODS.FRANCE, lat: 48.86, lon: 2.35 }, // Paris
  { method: CALCULATION_METHODS.TURKEY, lat: 39.93, lon: 32.86 }, // Ankara
  { method: CALCULATION_METHODS.RUSSIA, lat: 54.73, lon: 55.96 }, // Ufa
  { method: CALCULATION_METHODS.DUBAI, lat: 25.08, lon: 55.09 }, // Dubai
  { method: CALCULATION_METHODS.MALAYSIA, lat: 3.14, lon: 101.69 }, // Kuala Lumpur
  { method: CALCULATION_METHODS.TUNISIA, lat: 36.81, lon: 10.18 }, // Tunis
  { method: CALCULATION_METHODS.ALGERIA, lat: 36.75, lon: 3.06 }, // Algiers
  { method: CALCULATION_METHODS.INDONESIA, lat: -6.21, lon: 106.85 }, // Jakarta
  { method: CALCULATION_METHODS.MOROCCO, lat: 33.97, lon: -6.85 }, // Rabat
  { method: CALCULATION_METHODS.PORTUGAL, lat: 38.72, lon: -9.14 }, // Lisbon
  { method: CALCULATION_METHODS.JORDAN, lat: 31.95, lon: 35.92 }, // Amman

  // Supplementary anchors. Aladhan only publishes one coordinate per authority,
  // which leaves a few large populations nearer a neighbouring country's anchor
  // than their own. These extend an existing authority's reach; they add no new
  // convention.
  { method: CALCULATION_METHODS.MAKKAH, lat: 24.71, lon: 46.68 }, // Riyadh — otherwise nearer Doha
  { method: CALCULATION_METHODS.MWL, lat: 51.16, lon: 10.45 }, // Germany — otherwise nearer Paris
  { method: CALCULATION_METHODS.KARACHI, lat: 23.81, lon: 90.41 }, // Dhaka — otherwise beyond the cap
  { method: CALCULATION_METHODS.KARACHI, lat: 28.61, lon: 77.21 }, // Delhi — anchors northern India
];

/**
 * Past this distance from every anchor we have no regional signal, so we use
 * MWL — the standard international default — rather than an unrelated
 * neighbour's convention. This is what puts Sub-Saharan Africa and Australia
 * on MWL instead of Morocco or Indonesia.
 */
const MAX_ANCHOR_DISTANCE_KM = 1300;

const EARTH_RADIUS_KM = 6371;
const toRadians = (deg: number) => (deg * Math.PI) / 180;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/**
 * Countries where the Hanafi school predominates. Asr is ~1 hour later there,
 * which is by far the largest single discrepancy a user can see, so it is worth
 * resolving from the country code rather than a coordinate box.
 */
const HANAFI_COUNTRIES = new Set([
  'PK', 'IN', 'BD', 'AF', 'LK', 'NP', // South Asia
  'TR', 'CY', // Turkey
  'UZ', 'TM', 'TJ', 'KG', 'KZ', // Central Asia
  'AZ', 'GE', 'AM', // Caucasus
  'RU', 'UA', 'BY', 'MD', // Russia and neighbours
  'BA', 'AL', 'XK', 'MK', 'RS', 'ME', 'BG', // Balkans
  'SY', 'IQ', 'JO', 'LB', // Levant (mixed, Hanafi is the official Asr)
]);

export interface CalculationConfig {
  method: number;
  school: number;
  latitudeAdjustmentMethod?: number;
}

/**
 * Resolve the full calculation config for a location.
 *
 * @param countryCode ISO 3166-1 alpha-2, from reverse geocoding. Optional —
 *   when unavailable the Asr calculation falls back to the standard school,
 *   which is the majority convention worldwide.
 */
export function resolveCalculationConfig(
  latitude: number,
  longitude: number,
  countryCode?: string | null
): CalculationConfig {
  let nearest: Anchor | null = null;
  let nearestKm = Infinity;

  for (const anchor of ANCHORS) {
    const km = haversineKm(latitude, longitude, anchor.lat, anchor.lon);
    if (km < nearestKm) {
      nearestKm = km;
      nearest = anchor;
    }
  }

  const method =
    nearest && nearestKm <= MAX_ANCHOR_DISTANCE_KM
      ? nearest.method
      : CALCULATION_METHODS.MWL;

  const school = countryCode && HANAFI_COUNTRIES.has(countryCode.toUpperCase())
    ? SCHOOL.HANAFI
    : SCHOOL.STANDARD;

  const config: CalculationConfig = { method, school };

  if (Math.abs(latitude) >= HIGH_LATITUDE_THRESHOLD) {
    config.latitudeAdjustmentMethod = ANGLE_BASED;
  }

  return config;
}
