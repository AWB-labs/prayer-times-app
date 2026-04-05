import { useState, useEffect } from 'react';
import { fetchHijriCalendar, CalendarDay } from '../services/hijriCalendarApi';

interface HijriCalendarState {
  days: CalendarDay[];
  loading: boolean;
  error: string | null;
}

export function useHijriCalendar(month: number, year: number): HijriCalendarState {
  const [state, setState] = useState<HijriCalendarState>({
    days: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ days: [], loading: true, error: null });

    fetchHijriCalendar(month, year)
      .then((data) => {
        if (!cancelled) setState({ days: data, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({
            days: [],
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load calendar',
          });
      });

    return () => { cancelled = true; };
  }, [month, year]);

  return state;
}
