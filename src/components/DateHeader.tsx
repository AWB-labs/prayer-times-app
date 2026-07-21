import React from 'react';
import { View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  const gregorianDateStr = `${gregorian.weekday.en}, ${gregorian.day} ${gregorian.month.en}`;

  return (
    <View style={{ alignItems: 'center', paddingTop: 4, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <MaterialCommunityIcons name="mosque" size={18} color={theme.accent} />
        <Text
          accessibilityRole="header"
          style={{ color: theme.textSub, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', fontWeight: '600' }}
        >
          Prayer Times
        </Text>
      </View>

      <Text style={{ color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 8 }}>
        {gregorianDateStr}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
        {cityName ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <MaterialCommunityIcons name="map-marker" size={13} color={theme.textMuted} />
            <Text style={{ color: theme.textSub, fontSize: 12.5, fontWeight: '500' }}>{cityName}</Text>
          </View>
        ) : null}
        {cityName ? (
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>·</Text>
        ) : null}
        <Text style={{ color: theme.accent, fontSize: 12.5, fontWeight: '500', letterSpacing: 0.3 }}>
          {hijriDateStr}
        </Text>
      </View>
    </View>
  );
}
