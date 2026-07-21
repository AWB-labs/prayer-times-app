import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';

import { Prayer } from '../types';
import { getCountdownData, formatTo12Hour } from '../utils/prayerUtils';
import { useTheme } from '../context/ThemeContext';

function pad(n: number) {
  return String(n).padStart(2, '0');
}

interface Props {
  prayers: Prayer[];
  nextIndex: number;
}

/**
 * Compact, horizontal "next prayer" hero. Replaces the tall circular ring so the
 * daily check-ins fit on the same screen. Progress is shown as a slim linear bar.
 */
export function NextPrayerBanner({ prayers, nextIndex }: Props) {
  const { theme } = useTheme();
  const nextPrayer = prayers[nextIndex];

  const [countdown, setCountdown] = useState(() => getCountdownData(prayers, nextIndex));

  useEffect(() => {
    setCountdown(getCountdownData(prayers, nextIndex));
    const interval = setInterval(() => {
      setCountdown(getCountdownData(prayers, nextIndex));
    }, 1000);
    return () => clearInterval(interval);
  }, [prayers, nextIndex]);

  const { hours, minutes, seconds, progress } = countdown;

  const timeStr =
    hours > 0
      ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`;

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`Next prayer ${nextPrayer.name} at ${formatTo12Hour(nextPrayer.time)}, ${
        hours > 0 ? `${hours} hours ${minutes} minutes` : `${minutes} minutes`
      } remaining`}
      style={{
        marginHorizontal: 16,
        marginBottom: 14,
        borderRadius: 20,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.accentBorder,
        paddingHorizontal: 18,
        paddingVertical: 16,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: which prayer is next */}
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: theme.textMuted, fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: '700' }}>
            Next Prayer
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800', letterSpacing: 0.3 }}>
              {nextPrayer.name}
            </Text>
            <Text style={{ color: theme.textSub, fontSize: 15 }}>{nextPrayer.arabicName}</Text>
          </View>
          <View
            style={{
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 8,
              backgroundColor: theme.accentSurface,
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: theme.accentBorder,
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: '700' }}>
              {formatTo12Hour(nextPrayer.time)}
            </Text>
          </View>
        </View>

        {/* Right: live countdown */}
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={{
              color: theme.accent,
              fontSize: 30,
              fontWeight: '800',
              letterSpacing: 1,
              fontVariant: ['tabular-nums'],
            }}
          >
            {timeStr}
          </Text>
          <Text style={{ color: theme.textMuted, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>
            Remaining
          </Text>
        </View>
      </View>

      {/* Linear progress toward the next prayer */}
      <View
        style={{
          height: 5,
          borderRadius: 3,
          backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          marginTop: 14,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: theme.accent,
          }}
        />
      </View>
    </View>
  );
}
