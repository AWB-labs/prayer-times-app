import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useHijriCalendar } from '../hooks/useHijriCalendar';
import { weekdayIndex, CalendarDay } from '../services/hijriCalendarApi';
import { getEventsForHijriDate, IslamicEvent } from '../services/islamicEvents';
import { useTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme';

const EVENT_COLOR = '#34d399';

/** Curated events on a calendar day, replacing the API's holidays field. */
function eventsOn(day: CalendarDay): IslamicEvent[] {
  return getEventsForHijriDate(day.hijri.month.number, parseInt(day.hijri.day, 10));
}

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CELL_W = Math.floor((Dimensions.get('window').width - 32) / 7);

function todayGregorian() {
  const d = new Date();
  return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear() };
}

function hijriMonthHeader(days: CalendarDay[]): string {
  if (!days.length) return '';
  const months = new Set(days.map((d) => `${d.hijri.month.en} ${d.hijri.year}`));
  return Array.from(months).join(' / ');
}

interface DayCellProps {
  day: CalendarDay;
  isToday: boolean;
  isSelected: boolean;
  onPress: () => void;
  theme: AppTheme;
}

function DayCell({ day, isToday, isSelected, onPress, theme }: DayCellProps) {
  const events = eventsOn(day);
  const hasEvent = events.length > 0;
  const isMajorEvent = events.some((e) => e.major);
  const isFriday = day.gregorian.weekday.en === 'Friday';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{ width: CELL_W, paddingVertical: 4, alignItems: 'center' }}
    >
      <View
        style={[
          { width: CELL_W - 4, borderRadius: 10, paddingVertical: 6, alignItems: 'center' },
          isSelected && { backgroundColor: theme.accent },
          isToday && !isSelected && {
            backgroundColor: theme.accentSurface,
            borderWidth: 1,
            borderColor: theme.accentBorder,
          },
        ]}
      >
        <Text
          style={{
            fontSize: 15,
            fontWeight: isToday || isSelected ? '700' : '400',
            color: isSelected
              ? theme.accentFg
              : isFriday
              ? theme.accent
              : theme.text,
          }}
        >
          {day.gregorian.day}
        </Text>
        <Text
          style={{
            fontSize: 10,
            marginTop: 1,
            color: isSelected
              ? theme.accentFg + 'aa'
              : hasEvent
              ? EVENT_COLOR
              : theme.textMuted,
          }}
        >
          {day.hijri.day}
        </Text>
        {hasEvent && (
          <View
            style={{
              width: 4, height: 4, borderRadius: 2,
              backgroundColor: isSelected
                ? theme.accentFg
                : isMajorEvent
                ? EVENT_COLOR
                : EVENT_COLOR + '80',
              marginTop: 2,
            }}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

export function CalendarScreen() {
  const { theme } = useTheme();
  const today = todayGregorian();
  const [viewMonth, setViewMonth] = useState(today.month);
  const [viewYear, setViewYear] = useState(today.year);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const { days, loading, error } = useHijriCalendar(viewMonth, viewYear);

  const grid = useMemo(() => {
    if (!days.length) return [];
    const firstOffset = weekdayIndex(days[0].gregorian.weekday.en);
    const cells: (CalendarDay | null)[] = [
      ...Array(firstOffset).fill(null),
      ...days,
    ];
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [days]);

  const rows: (CalendarDay | null)[][] = [];
  for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));

  function prevMonth() {
    if (viewMonth === 1) { setViewMonth(12); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (viewMonth === 12) { setViewMonth(1); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
    setSelectedDay(null);
  }

  const isCurrentMonth = viewMonth === today.month && viewYear === today.year;

  const navBtn = {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.surface,
    borderWidth: 1, borderColor: theme.border,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.statusBar} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── Header ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={navBtn}>
                <Ionicons name="chevron-back" size={18} color={theme.textSub} />
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>
                  {MONTH_NAMES[viewMonth - 1]} {viewYear}
                </Text>
                {days.length > 0 && (
                  <Text style={{ color: theme.accent + 'bb', fontSize: 12, marginTop: 2 }}>
                    {hijriMonthHeader(days)} AH
                  </Text>
                )}
              </View>

              <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={navBtn}>
                <Ionicons name="chevron-forward" size={18} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            {!isCurrentMonth && (
              <TouchableOpacity
                onPress={() => { setViewMonth(today.month); setViewYear(today.year); setSelectedDay(null); }}
                style={{ alignSelf: 'center', marginTop: 8 }}
              >
                <Text style={{ color: theme.accent, fontSize: 12 }}>Today ↩</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Week day labels ── */}
          <View style={{ flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4 }}>
            {WEEK_DAYS.map((d) => (
              <View key={d} style={{ width: CELL_W, alignItems: 'center' }}>
                <Text
                  style={{
                    fontSize: 11, fontWeight: '600', letterSpacing: 0.5,
                    color: d === 'Fri' ? theme.accent : theme.textMuted,
                  }}
                >
                  {d}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ height: 1, backgroundColor: theme.border, marginHorizontal: 16, marginBottom: 8 }} />

          {/* ── Calendar grid ── */}
          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <ActivityIndicator color={theme.accent} size="large" />
              <Text style={{ color: theme.textMuted, marginTop: 12, fontSize: 13 }}>
                Loading calendar…
              </Text>
            </View>
          ) : error ? (
            <View style={{ paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 }}>
              <Ionicons name="warning-outline" size={36} color={theme.textMuted} />
              <Text style={{ color: theme.textSub, marginTop: 10, textAlign: 'center', fontSize: 13 }}>
                {error}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              {rows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', marginBottom: 2 }}>
                  {row.map((cell, ci) =>
                    cell ? (
                      <DayCell
                        key={ci}
                        day={cell}
                        theme={theme}
                        isToday={isCurrentMonth && parseInt(cell.gregorian.day, 10) === today.day}
                        isSelected={selectedDay?.gregorian.date === cell.gregorian.date}
                        onPress={() =>
                          setSelectedDay(
                            selectedDay?.gregorian.date === cell.gregorian.date ? null : cell
                          )
                        }
                      />
                    ) : (
                      <View key={ci} style={{ width: CELL_W }} />
                    )
                  )}
                </View>
              ))}
            </View>
          )}

          {/* ── Selected day detail ── */}
          {selectedDay && (
            <View
              style={{
                marginHorizontal: 16, marginTop: 16,
                borderRadius: 16,
                backgroundColor: theme.surface,
                borderWidth: 1, borderColor: theme.accentBorder,
                padding: 16,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700' }}>
                    {selectedDay.gregorian.weekday.en},{' '}
                    {MONTH_NAMES[selectedDay.gregorian.month.number - 1]}{' '}
                    {selectedDay.gregorian.day}, {selectedDay.gregorian.year}
                  </Text>
                  <Text style={{ color: theme.accent, fontSize: 14, marginTop: 4 }}>
                    {selectedDay.hijri.day} {selectedDay.hijri.month.en} {selectedDay.hijri.year} AH
                  </Text>
                  <Text style={{ color: theme.accent + '88', fontSize: 13, marginTop: 2 }}>
                    {selectedDay.hijri.day} {selectedDay.hijri.month.ar} {selectedDay.hijri.year} هـ
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setSelectedDay(null)}>
                  <Ionicons name="close-circle" size={22} color={theme.textMuted} />
                </TouchableOpacity>
              </View>

              {eventsOn(selectedDay).length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: EVENT_COLOR + 'bb', fontSize: 11, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {eventsOn(selectedDay).length > 1 ? 'Islamic Events' : 'Islamic Event'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {eventsOn(selectedDay).map((e) => (
                      <View
                        key={e.name}
                        style={{
                          flexDirection: 'row', alignItems: 'center',
                          backgroundColor: 'rgba(52,211,153,0.1)',
                          borderWidth: 1, borderColor: 'rgba(52,211,153,0.25)',
                          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                          marginRight: 8, marginBottom: 6,
                        }}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: EVENT_COLOR, marginRight: 6 }} />
                        <Text style={{ color: EVENT_COLOR, fontSize: 12, fontWeight: '500' }}>{e.name}</Text>
                        <Text style={{ color: EVENT_COLOR + '99', fontSize: 12, marginLeft: 6 }}>{e.arabicName}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* ── Events this month ── */}
          {!loading && !error && (() => {
            // List each event once. A multi-day span is reported on the day it
            // starts, or on the first visible day when it began before this
            // Gregorian month.
            const seen = new Set<string>();
            const holidays = days.flatMap((d, di) =>
              eventsOn(d)
                .filter((e) => {
                  const isStart = parseInt(d.hijri.day, 10) === e.day;
                  if (!isStart && di !== 0) return false;
                  const key = `${e.month}-${e.name}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                })
                .map((e) => ({
                  label: e.name,
                  arabic: e.arabicName,
                  major: e.major,
                  gregDay: parseInt(d.gregorian.day, 10),
                  hijriDate: `${d.hijri.day} ${d.hijri.month.en}`,
                }))
            );
            if (!holidays.length) return null;
            return (
              <View style={{ marginHorizontal: 16, marginTop: 16, marginBottom: 8 }}>
                <Text style={{ color: theme.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                  Events this month
                </Text>
                {holidays.map((h, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                      borderBottomWidth: i < holidays.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border,
                    }}
                  >
                    <View style={{
                      width: 8, height: 8, borderRadius: 4,
                      backgroundColor: h.major ? EVENT_COLOR : EVENT_COLOR + '80',
                      marginRight: 12,
                    }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: theme.text, fontSize: 14, fontWeight: h.major ? '600' : '500' }}>
                        {h.label}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>
                        {MONTH_NAMES[viewMonth - 1]} {h.gregDay} · {h.hijriDate} AH
                      </Text>
                    </View>
                    <Text style={{ color: EVENT_COLOR + '99', fontSize: 13 }}>{h.arabic}</Text>
                  </View>
                ))}
              </View>
            );
          })()}

          {/* ── Legend ── */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, marginTop: 12, marginBottom: 24, gap: 12 }}>
            {[
              { color: theme.accent, label: 'Today / Friday' },
              { color: EVENT_COLOR, label: 'Major event' },
              { color: EVENT_COLOR + '80', label: 'Observance' },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 5 }} />
                <Text style={{ color: theme.textMuted, fontSize: 11 }}>{item.label}</Text>
              </View>
            ))}
            <Text style={{ color: theme.textMuted + '66', fontSize: 11 }}>
              Large = Gregorian · Small = Hijri
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
