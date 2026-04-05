import React from 'react';
import { View, Text } from 'react-native';
import { PrayerDate } from '../types';
import { useTheme } from '../context/ThemeContext';

interface Props {
  date: PrayerDate;
  cityName: string | null;
}

export function DateHeader({ date, cityName }: Props) {
  const { theme } = useTheme();
  const { hijri, gregorian } = date;

  const hijriDateStr = `${hijri.day} ${hijri.month.en} ${hijri.year} AH`;
  const gregorianDateStr = `${gregorian.weekday.en}, ${gregorian.day} ${gregorian.month.en} ${gregorian.year}`;

  return (
    <View style={{ alignItems: 'center', paddingTop: 8, paddingBottom: 24 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🕌</Text>

      <Text style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', marginBottom: 4 }}>
        Prayer Times
      </Text>

      {cityName && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ color: theme.textSub, fontSize: 14 }}>📍 </Text>
          <Text style={{ color: theme.textSub, fontSize: 14, fontWeight: '500' }}>{cityName}</Text>
        </View>
      )}

      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600', marginBottom: 6 }}>
        {gregorianDateStr}
      </Text>

      <View style={{ backgroundColor: theme.accentSurface, borderWidth: 1, borderColor: theme.accentBorder, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999 }}>
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '500', letterSpacing: 0.5 }}>
          {hijriDateStr}
        </Text>
      </View>
    </View>
  );
}
