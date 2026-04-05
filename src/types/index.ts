export interface PrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak: string;
  Midnight: string;
  Firstthird: string;
  Lastthird: string;
}

export interface HijriDate {
  date: string;
  day: string;
  weekday: { en: string; ar: string };
  month: { number: number; en: string; ar: string };
  year: string;
  holidays: string[];
}

export interface GregorianDate {
  date: string;
  day: string;
  weekday: { en: string };
  month: { number: number; en: string };
  year: string;
}

export interface PrayerDate {
  readable: string;
  timestamp: string;
  hijri: HijriDate;
  gregorian: GregorianDate;
}

export interface PrayerMeta {
  latitude: number;
  longitude: number;
  timezone: string;
  method: {
    id: number;
    name: string;
    params: Record<string, number>;
  };
}

export interface PrayerData {
  timings: PrayerTimings;
  date: PrayerDate;
  meta: PrayerMeta;
}

export interface ApiResponse {
  code: number;
  status: string;
  data: PrayerData;
}

export type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export interface Prayer {
  name: PrayerName;
  time: string;
  arabicName: string;
  icon: string;
}
