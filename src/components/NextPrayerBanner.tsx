import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Prayer } from '../types';
import { getCountdownData, formatTo12Hour } from '../utils/prayerUtils';
import { useTheme } from '../context/ThemeContext';

/* ── Dimensions ─────────────────────────────────────────────────────────── */
const RADIUS = 88;
const STROKE = 10;
const SIZE = (RADIUS + STROKE) * 2; // 196
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function pad(n: number) {
  return String(n).padStart(2, '0');
}

/* ── CircularRing ────────────────────────────────────────────────────────── */
interface RingProps {
  progress: number; // 0–1
  accent: string;
  trackColor: string;
}

function CircularRing({ progress, accent, trackColor }: RingProps) {
  const offset = CIRCUMFERENCE * (1 - progress);
  const gradId = 'prayerArcGrad';

  return (
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={accent} stopOpacity="0.6" />
          <Stop offset="100%" stopColor={accent} stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* Track ring */}
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />

      {/* Glow halo – slightly wider, very transparent */}
      {progress > 0.02 && (
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={accent}
          strokeWidth={STROKE + 6}
          strokeOpacity={0.12}
          fill="none"
          strokeDasharray={`${CIRCUMFERENCE}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${SIZE / 2}, ${SIZE / 2}`}
        />
      )}

      {/* Progress arc */}
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={`url(#${gradId})`}
        strokeWidth={STROKE}
        fill="none"
        strokeDasharray={`${CIRCUMFERENCE}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        rotation={-90}
        origin={`${SIZE / 2}, ${SIZE / 2}`}
      />
    </Svg>
  );
}

/* ── NextPrayerBanner ────────────────────────────────────────────────────── */
interface Props {
  prayers: Prayer[];
  nextIndex: number;
}

export function NextPrayerBanner({ prayers, nextIndex }: Props) {
  const { theme } = useTheme();
  const nextPrayer = prayers[nextIndex];

  const [countdown, setCountdown] = useState(() =>
    getCountdownData(prayers, nextIndex)
  );

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

  const unitLabel = hours > 0 ? 'h  :  m  :  s' : 'm  :  s';

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 24,
        borderRadius: 28,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.accentBorder,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
      }}
    >
      {/* Section label */}
      <Text
        style={{
          color: theme.textMuted,
          fontSize: 11,
          letterSpacing: 3,
          textTransform: 'uppercase',
          marginBottom: 20,
        }}
      >
        Next Prayer
      </Text>

      {/* ── Circular ring + countdown ─────────────────────────── */}
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        {/* SVG ring sits behind the text */}
        <CircularRing
          progress={progress}
          accent={theme.accent}
          trackColor={theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}
        />

        {/* Centred text overlay */}
        <View
          style={{
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: theme.text,
              fontSize: hours > 0 ? 28 : 34,
              fontWeight: '800',
              letterSpacing: 2,
              fontVariant: ['tabular-nums'],
            }}
          >
            {timeStr}
          </Text>
          <Text
            style={{
              color: theme.textMuted,
              fontSize: 10,
              letterSpacing: 2,
              marginTop: 4,
            }}
          >
            {unitLabel}
          </Text>

          {/* Small progress percentage pill */}
          <View
            style={{
              marginTop: 10,
              backgroundColor: theme.accentSurface,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderWidth: 1,
              borderColor: theme.accentBorder,
            }}
          >
            <Text style={{ color: theme.accent, fontSize: 11, fontWeight: '700' }}>
              {Math.round(progress * 100)}%
            </Text>
          </View>
        </View>
      </View>

      {/* ── Prayer info ───────────────────────────────────────── */}
      <View style={{ marginTop: 20, alignItems: 'center' }}>
        {/* Divider */}
        <View
          style={{
            width: 40,
            height: 3,
            borderRadius: 2,
            backgroundColor: theme.accent,
            opacity: 0.6,
            marginBottom: 14,
          }}
        />

        <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', letterSpacing: 0.5 }}>
          {nextPrayer.name}
        </Text>

        <Text style={{ color: theme.textSub, fontSize: 18, marginTop: 2 }}>
          {nextPrayer.arabicName}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 10,
            backgroundColor: theme.accentSurface,
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 6,
            borderWidth: 1,
            borderColor: theme.accentBorder,
          }}
        >
          <Text style={{ color: theme.accent, fontSize: 16, fontWeight: '700' }}>
            {formatTo12Hour(nextPrayer.time)}
          </Text>
        </View>
      </View>
    </View>
  );
}
