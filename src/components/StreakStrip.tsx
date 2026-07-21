import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../context/ThemeContext';
import { useStreak, getDateString } from '../hooks/useStreak';
import { usePrayerLogContext, STREAK_PRAYERS } from '../context/PrayerLogContext';

/**
 * Compact home-screen streak summary. Reflects the daily check-ins (5 dots),
 * shows the current streak, and links to the full Streak screen.
 */
export function StreakStrip() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { currentStreak, todayCount } = useStreak();
  const { isPrayerDone } = usePrayerLogContext();
  const today = getDateString();

  const active = currentStreak > 0;
  const flameColor = active ? theme.flame : theme.textMuted;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => navigation.navigate('Streak')}
      accessibilityRole="button"
      accessibilityLabel={`Prayer streak ${currentStreak} ${
        currentStreak === 1 ? 'day' : 'days'
      }, ${todayCount} of 5 prayers today. Opens streak details.`}
      style={{
        marginHorizontal: 16,
        marginBottom: 14,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: active ? theme.flameSurface : theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? theme.flameSurface : theme.border,
          }}
        >
          <Ionicons name="flame" size={20} color={flameColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text style={{ color: theme.text, fontSize: 20, fontWeight: '800' }}>{currentStreak}</Text>
            <Text style={{ color: theme.textSub, fontSize: 12.5, fontWeight: '500' }}>
              {currentStreak === 1 ? 'day streak' : 'day streak'}
            </Text>
          </View>
          <Text style={{ color: theme.textMuted, fontSize: 11 }}>{todayCount} of 5 prayers today</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {STREAK_PRAYERS.map((prayer) => {
            const done = isPrayerDone(today, prayer);
            return (
              <View
                key={prayer}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  backgroundColor: done ? theme.success : 'transparent',
                  borderWidth: done ? 0 : 1.5,
                  borderColor: theme.textMuted,
                }}
              />
            );
          })}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </View>
    </TouchableOpacity>
  );
}
