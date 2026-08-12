/**
 * Curated Islamic calendar events, keyed by Hijri date.
 *
 * The Aladhan `holidays` field is not used. It returns 78 entries, of which 55
 * are Naqshbandi-tariqa Urs and shaykh commemorations that are not observed by
 * most users, and it has no entry for the Islamic New Year. This table keeps
 * the widely observed dates, collapses the repeated Laylat al-Qadr and Hajj
 * rows into single spans, and fills the gaps.
 */

export interface IslamicEvent {
  /** Hijri month, 1 = Muharram */
  month: number;
  /** Hijri day the event starts on */
  day: number;
  /** Last day, inclusive, for events spanning several days */
  endDay?: number;
  name: string;
  arabicName: string;
  /** Major events are the ones worth emphasising in the UI */
  major: boolean;
}

export const ISLAMIC_EVENTS: IslamicEvent[] = [
  { month: 1, day: 1, name: 'Islamic New Year', arabicName: 'رأس السنة الهجرية', major: true },
  { month: 1, day: 10, name: 'Day of Ashura', arabicName: 'عاشوراء', major: true },
  { month: 3, day: 12, name: 'Mawlid al-Nabi ﷺ', arabicName: 'المولد النبوي', major: true },
  { month: 7, day: 1, name: 'Rajab — Sacred Month Begins', arabicName: 'شهر رجب', major: false },
  { month: 7, day: 27, name: "Isra & Mi'raj", arabicName: 'الإسراء والمعراج', major: true },
  { month: 8, day: 15, name: "Laylat al-Bara'at", arabicName: 'ليلة البراءة', major: false },
  { month: 9, day: 1, name: 'Ramadan Begins', arabicName: 'رمضان', major: true },
  { month: 9, day: 21, endDay: 30, name: 'Last Ten Nights', arabicName: 'العشر الأواخر', major: false },
  { month: 9, day: 27, name: 'Laylat al-Qadr', arabicName: 'ليلة القدر', major: true },
  { month: 10, day: 1, endDay: 3, name: 'Eid al-Fitr', arabicName: 'عيد الفطر', major: true },
  { month: 12, day: 8, endDay: 13, name: 'Days of Hajj', arabicName: 'أيام الحج', major: false },
  { month: 12, day: 9, name: 'Day of Arafah', arabicName: 'يوم عرفة', major: true },
  { month: 12, day: 10, endDay: 13, name: 'Eid al-Adha', arabicName: 'عيد الأضحى', major: true },
];

/**
 * Events falling on a Hijri date. Multi-day events match every day in range,
 * so a span such as Ramadan's last ten nights marks each of its days.
 */
export function getEventsForHijriDate(month: number, day: number): IslamicEvent[] {
  return ISLAMIC_EVENTS.filter(
    (e) => e.month === month && day >= e.day && day <= (e.endDay ?? e.day)
  );
}

/** True when any event falls on this Hijri date. */
export function hasEvent(month: number, day: number): boolean {
  return getEventsForHijriDate(month, day).length > 0;
}

/**
 * Events for a month listing, each reported once on its starting day rather
 * than repeated for every day it spans.
 */
export function getEventStartsForHijriMonth(month: number): IslamicEvent[] {
  return ISLAMIC_EVENTS.filter((e) => e.month === month);
}
