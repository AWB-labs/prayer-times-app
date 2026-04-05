const BASE_URL = 'https://api.aladhan.com/v1';

export interface CalendarHijriDate {
  date: string;
  day: string;
  weekday: { en: string; ar: string };
  month: { number: number; en: string; ar: string; days: number };
  year: string;
  holidays: string[];
}

export interface CalendarGregorianDate {
  date: string;
  day: string;
  weekday: { en: string };
  month: { number: number; en: string };
  year: string;
}

export interface CalendarDay {
  hijri: CalendarHijriDate;
  gregorian: CalendarGregorianDate;
}

interface CalendarApiResponse {
  code: number;
  status: string;
  data: CalendarDay[];
}

/** Maps English weekday name from the API to Sunday=0 … Saturday=6 */
export function weekdayIndex(en: string): number {
  const map: Record<string, number> = {
    'Al Ahad': 0,
    'Al Athnayn': 1,
    'Al Thalaata': 2,
    "Al Arba'a": 3,
    'Al Khamees': 4,
    "Al Juma'a": 5,
    'Al Sabt': 6,
  };
  return map[en] ?? 0;
}

/**
 * Fetch the Gregorian→Hijri calendar for a given month/year.
 * Endpoint: GET /v1/gToHCalendar/{month}/{year}
 */
export async function fetchHijriCalendar(
  month: number,
  year: number
): Promise<CalendarDay[]> {
  const url = `${BASE_URL}/gToHCalendar/${month}/${year}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const json: CalendarApiResponse = await response.json();

  if (json.code !== 200) {
    throw new Error(`Calendar API error: ${json.status}`);
  }

  return json.data;
}
