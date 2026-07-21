import React from 'react';
import {
  View,
  Text,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useLocation } from '../hooks/useLocation';
import { useQibla } from '../hooks/useQibla';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────────────────────── */
const COMPASS_SIZE = 290;
const R = COMPASS_SIZE / 2; // 145

/* ─────────────────────────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────────────────────────── */

/** Compass ring: cardinal labels + tick marks */
function CompassRing({ textColor }: { textColor: string }) {
  const CARDINALS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return (
    <View style={{ width: COMPASS_SIZE, height: COMPASS_SIZE, position: 'absolute' }}>
      {CARDINALS.map((label, i) => {
        const angle = (i * 360) / CARDINALS.length;
        const rad = (angle * Math.PI) / 180;
        const offset = R * 0.80;
        const x = R + offset * Math.sin(rad) - (label.length > 1 ? 12 : 7);
        const y = R - offset * Math.cos(rad) - 10;
        const isMajor = i % 2 === 0;
        return (
          <Text
            key={label}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              color: label === 'N' ? textColor + '60' : isMajor ? textColor + 'cc' : textColor + '44',
              fontSize: isMajor ? 13 : 10,
              fontWeight: isMajor ? '700' : '400',
            }}
          >
            {label}
          </Text>
        );
      })}

      {Array.from({ length: 72 }).map((_, i) => {
        const angle = i * 5;
        const rad = (angle * Math.PI) / 180;
        const isMajorTick = i % 6 === 0;
        const inner = R * (isMajorTick ? 0.64 : 0.68);
        const outer = R * 0.72;
        const x1 = R + inner * Math.sin(rad);
        const y1 = R - inner * Math.cos(rad);
        const x2 = R + outer * Math.sin(rad);
        const y2 = R - outer * Math.cos(rad);
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: x1,
              top: y1,
              width: Math.abs(x2 - x1) || 1.5,
              height: Math.abs(y2 - y1) || 1.5,
              backgroundColor: isMajorTick ? textColor + '70' : textColor + '25',
            }}
          />
        );
      })}
    </View>
  );
}

/** Elegant needle with tapered tip and rounded tail */
function Needle({ color, aligned }: { color: string; aligned: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {/* Tip – narrow triangle */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderBottomWidth: 52,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
      {/* Middle body */}
      <View
        style={{
          width: 10,
          height: 18,
          backgroundColor: color,
          opacity: 0.75,
        }}
      />
      {/* Tail – slightly wider */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 7,
          borderRightWidth: 7,
          borderTopWidth: 22,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: aligned ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.15)',
        }}
      />
    </View>
  );
}

/** Static Kaaba badge at the 12-o'clock position */
function KaabaPin({ aligned }: { aligned: boolean }) {
  const glowColor = aligned ? '#22c55e' : '#ffc107';
  const bgColor = aligned ? 'rgba(34,197,94,0.18)' : 'rgba(255,193,7,0.15)';
  const borderColor = aligned ? 'rgba(34,197,94,0.7)' : 'rgba(255,193,7,0.5)';

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Badge */}
      <View
        style={{
          backgroundColor: bgColor,
          borderRadius: 18,
          borderWidth: 2,
          borderColor,
          paddingHorizontal: 12,
          paddingVertical: 7,
          // Glow shadow
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: aligned ? 0.9 : 0.5,
          shadowRadius: aligned ? 14 : 8,
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 30, lineHeight: 34 }}>🕋</Text>
      </View>

      {/* Connector stem down to ring edge */}
      <View
        style={{
          width: 2,
          height: 20,
          borderRadius: 1,
          backgroundColor: glowColor,
          opacity: aligned ? 0.9 : 0.4,
        }}
      />

      {/* Triangle pointer touching the ring edge */}
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: 6,
          borderRightWidth: 6,
          borderTopWidth: 8,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderTopColor: aligned ? '#22c55e' : 'rgba(255,193,7,0.6)',
        }}
      />
    </View>
  );
}

/** Glow pulse ring underneath the compass when aligned */
function AlignedGlowRing({ accent }: { accent: string }) {
  const SIZE = COMPASS_SIZE + 32;
  return (
    <Svg
      width={SIZE}
      height={SIZE}
      style={{ position: 'absolute', left: -16, top: -16 }}
    >
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" rx="50%">
          <Stop offset="55%" stopColor={accent} stopOpacity="0" />
          <Stop offset="100%" stopColor={accent} stopOpacity="0.22" />
        </RadialGradient>
      </Defs>
      <Circle cx={SIZE / 2} cy={SIZE / 2} r={SIZE / 2} fill="url(#glow)" />
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   Main screen
   ───────────────────────────────────────────────────────────────────────── */
export function QiblaScreen() {
  const { theme } = useTheme();
  const location = useLocation();
  const {
    qiblaBearing,
    deviceHeading,
    needleAnim,
    loading,
    error,
    sensorAvailable,
  } = useQibla(location.latitude, location.longitude);

  const isAligned =
    qiblaBearing !== null &&
    Math.abs(((qiblaBearing - deviceHeading + 540) % 360) - 180) < 5;

  const spin = needleAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
    extrapolate: 'extend',
  });

  const accentColor = isAligned ? '#22c55e' : theme.accent;

  /* ── Loading / error gates ── */
  if (location.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <StatusBar style={theme.statusBar} />
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={{ color: theme.textSub, marginTop: 16, fontSize: 14 }}>Getting your location…</Text>
      </View>
    );
  }

  if (location.error) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
        <StatusBar style={theme.statusBar} />
        <Ionicons name="location-outline" size={48} color={theme.textMuted} />
        <Text style={{ color: theme.textSub, textAlign: 'center', marginTop: 16, lineHeight: 24 }}>
          {location.error}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.statusBar} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{ paddingBottom: 40, alignItems: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header ── */}
          <View style={{ width: '100%', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 }}>
            <Text style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}>القبلة</Text>
            <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>Qibla Direction</Text>
            {location.cityName ? (
              <Text style={{ color: theme.accent + 'bb', fontSize: 12, marginTop: 4 }}>
                📍 {location.cityName}
              </Text>
            ) : null}
          </View>

          {/* ── Kaaba + Compass assembly ── */}
          <View style={{ alignItems: 'center', marginTop: 4 }}>

            {/* Static Kaaba pin at 12 o'clock — always on top */}
            <KaabaPin aligned={isAligned} />

            {/* Compass ring container */}
            <View style={{ width: COMPASS_SIZE, height: COMPASS_SIZE }}>
              {/* Green glow halo when aligned */}
              {isAligned && <AlignedGlowRing accent="#22c55e" />}

              {/* Outer border ring */}
              <View
                style={{
                  position: 'absolute',
                  width: COMPASS_SIZE,
                  height: COMPASS_SIZE,
                  borderRadius: COMPASS_SIZE / 2,
                  borderWidth: 2,
                  borderColor: isAligned ? 'rgba(34,197,94,0.5)' : theme.borderStrong,
                  backgroundColor: theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                }}
              />

              {/* Inner decorative ring */}
              <View
                style={{
                  position: 'absolute',
                  width: COMPASS_SIZE - 48,
                  height: COMPASS_SIZE - 48,
                  left: 24,
                  top: 24,
                  borderRadius: (COMPASS_SIZE - 48) / 2,
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              />

              {/* Cardinal labels + tick marks */}
              <CompassRing textColor={theme.text} />

              {/* Animated needle */}
              {loading ? (
                <View style={{ position: 'absolute', width: COMPASS_SIZE, height: COMPASS_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                  <ActivityIndicator color={theme.accent} size="large" />
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>Finding Qibla…</Text>
                </View>
              ) : error ? (
                <View style={{ position: 'absolute', width: COMPASS_SIZE, height: COMPASS_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="warning-outline" size={32} color={theme.textMuted} />
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 24 }}>
                    {error}
                  </Text>
                </View>
              ) : (
                <Animated.View
                  style={{
                    position: 'absolute',
                    width: COMPASS_SIZE,
                    height: COMPASS_SIZE,
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: [{ rotate: spin }],
                  }}
                >
                  <Needle color={accentColor} aligned={isAligned} />
                </Animated.View>
              )}

              {/* Center jewel */}
              <View
                style={{
                  position: 'absolute',
                  left: R - 10,
                  top: R - 10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: accentColor,
                  borderWidth: 3,
                  borderColor: theme.bg,
                  shadowColor: accentColor,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.7,
                  shadowRadius: 6,
                  elevation: 4,
                }}
              />
            </View>
          </View>

          {/* ── Instruction card ── */}
          <View
            style={{
              marginTop: 24,
              marginHorizontal: 20,
              paddingHorizontal: 24,
              paddingVertical: 14,
              borderRadius: 18,
              backgroundColor: isAligned ? 'rgba(34,197,94,0.12)' : theme.accentSurface,
              borderWidth: 1,
              borderColor: isAligned ? 'rgba(34,197,94,0.4)' : theme.accentBorder,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 16,
                color: isAligned ? '#22c55e' : theme.accent,
                marginBottom: 4,
              }}
            >
              {isAligned ? '✓  اتجاه القبلة' : 'وجّه السهم نحو 🕋'}
            </Text>
            <Text
              style={{
                fontSize: 13,
                textAlign: 'center',
                color: isAligned ? 'rgba(34,197,94,0.8)' : theme.textSub,
                lineHeight: 18,
              }}
            >
              {isAligned
                ? 'You are facing the Qibla — face of the Kaaba'
                : 'Rotate your phone until the needle points at the Kaaba icon above'}
            </Text>
          </View>

          {/* ── Stats cards ── */}
          {!loading && !error && (
            <View style={{ flexDirection: 'row', marginTop: 20, marginHorizontal: 20, gap: 12 }}>
              {[
                {
                  label: 'Qibla bearing',
                  value: qiblaBearing !== null ? `${qiblaBearing.toFixed(1)}°` : '—',
                  sub: 'from North',
                  icon: 'compass-outline' as const,
                },
                {
                  label: 'Device heading',
                  value: sensorAvailable ? `${Math.round(deviceHeading)}°` : '—',
                  sub: sensorAvailable ? 'magnetic north' : 'no sensor',
                  icon: 'phone-portrait-outline' as const,
                },
              ].map((stat) => (
                <View
                  key={stat.label}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    padding: 14,
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.border,
                  }}
                >
                  <Ionicons name={stat.icon} size={16} color={theme.textMuted} style={{ marginBottom: 6 }} />
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginBottom: 4 }}>{stat.label}</Text>
                  <Text style={{ color: theme.text, fontSize: 22, fontWeight: '800' }}>{stat.value}</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}>{stat.sub}</Text>
                </View>
              ))}
            </View>
          )}

          {/* ── No sensor warning ── */}
          {!sensorAvailable && (
            <View
              style={{
                marginTop: 16,
                marginHorizontal: 20,
                padding: 14,
                borderRadius: 14,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.border,
                flexDirection: 'row',
                alignItems: 'flex-start',
              }}
            >
              <Ionicons name="information-circle-outline" size={18} color={theme.textMuted} style={{ marginRight: 8, marginTop: 1 }} />
              <Text style={{ color: theme.textSub, fontSize: 13, lineHeight: 20, flex: 1 }}>
                Magnetometer not available on this device. The Qibla bearing is shown but live compass tracking is disabled.
              </Text>
            </View>
          )}

          <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 24, textAlign: 'center' }}>
            Powered by AlAdhan.com Qibla API
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
