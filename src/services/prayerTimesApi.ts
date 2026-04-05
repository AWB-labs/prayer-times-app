import { ApiResponse, PrayerData } from '../types';

const BASE_URL = 'https://api.aladhan.com/v1';

// Calculation methods: 2 = ISNA, 3 = MWL, 4 = Makkah, 5 = Egypt, 1 = University of Islamic Sciences, Karachi
export const CALCULATION_METHODS = {
  MWL: 3,
  ISNA: 2,
  EGYPT: 5,
  MAKKAH: 4,
  KARACHI: 1,
  TEHRAN: 7,
  JAFARI: 0,
} as const;

export async function fetchPrayerTimes(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
  method: number = CALCULATION_METHODS.MWL
): Promise<PrayerData> {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const dateStr = `${day}-${month}-${year}`;

  const url = `${BASE_URL}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${method}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch prayer times: ${response.status}`);
  }

  const json: ApiResponse = await response.json();

  if (json.code !== 200) {
    throw new Error(`API error: ${json.status}`);
  }

  return json.data;
}
