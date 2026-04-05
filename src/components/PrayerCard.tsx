import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Prayer } from '../types';
import { formatTo12Hour } from '../utils/prayerUtils';
import { useTheme } from '../context/ThemeContext';
import { STREAK_PRAYERS, StreakPrayerName } from '../context/PrayerLogContext';

const PRAYER_ICONS: Record<string, string> = {
  Fajr: '🌙',
  Sunrise: '🌅',
  Dhuhr: '☀️',
  Asr: '🌤',
  Maghrib: '🌇',
  Isha: '🌃',
};

/** Only the 5 obligatory prayers have a streak toggle */
function isStreakPrayer(name: string): name is StreakPrayerName {
  return (STREAK_PRAYERS as readonly string[]).includes(name);
}

interface Props {
  prayer: Prayer;
  isCurrent: boolean;
  isNext: boolean;
  isCompleted?: boolean;
  onToggle?: () => void;
}

function DoneButton({
  done,
  onPress,
  darkBg,
}: {
  done: boolean;
  onPress: () => void;
  darkBg?: boolean;
}) {
  const { theme } = useTheme();
  const fillColor = done ? '#22c55e' : 'transparent';
  const borderColor = done
    ? '#22c55e'
    : darkBg
    ? 'rgba(255,255,255,0.35)'
    : theme.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: fillColor,
        borderWidth: 2,
        borderColor,
        alignItems: 'center',
        justifyContent: 'center',
        // Green glow when done
        shadowColor: done ? '#22c55e' : 'transparent',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: done ? 0.6 : 0,
        shadowRadius: 6,
        elevation: done ? 4 : 0,
      }}
    >
      {done && (
        <Ionicons name="checkmark" size={16} color="#ffffff" />
      )}
    </TouchableOpacity>
  );
}

export function PrayerCard({
  prayer,
  isCurrent,
  isNext,
  isCompleted = false,
  onToggle,
}: Props) {
  const { theme } = useTheme();
  const icon = PRAYER_ICONS[prayer.name] ?? '🕐';
  const canToggle = isStreakPrayer(prayer.name) && !!onToggle;

  if (isCurrent) {
    return (
      <View
        style={{
          marginHorizontal: 16,
          marginBottom: 12,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: isCompleted ? '#22c55e' : theme.accent,
          shadowColor: isCompleted ? '#22c55e' : theme.accent,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.35,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.accentFg, fontWeight: '700', fontSize: 15 }}>{prayer.name}</Text>
              <Text style={{ color: theme.accentFg + 'aa', fontSize: 12 }}>{prayer.arabicName}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: theme.accentFg, fontWeight: '700', fontSize: 17 }}>
                {formatTo12Hour(prayer.time)}
              </Text>
              <View style={{ backgroundColor: 'rgba(0,0,0,0.12)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginTop: 2 }}>
                <Text style={{ color: theme.accentFg, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
                  {isCompleted ? 'DONE ✓' : 'CURRENT'}
                </Text>
              </View>
            </View>
            {canToggle && (
              <DoneButton done={isCompleted} onPress={onToggle!} darkBg />
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: isCompleted
          ? 'rgba(34,197,94,0.08)'
          : isNext
          ? theme.surface2
          : theme.surface,
        borderWidth: 1,
        borderColor: isCompleted
          ? 'rgba(34,197,94,0.3)'
          : isNext
          ? theme.accentBorder
          : theme.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isCompleted
                ? 'rgba(34,197,94,0.15)'
                : isNext
                ? theme.accentSurface
                : theme.border,
            }}
          >
            <Text style={{ fontSize: 20 }}>{icon}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: isCompleted
                  ? '#22c55e'
                  : isNext
                  ? theme.text
                  : theme.textSub,
                fontWeight: '600',
                fontSize: 15,
              }}
            >
              {prayer.name}
            </Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>{prayer.arabicName}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ alignItems: 'flex-end' }}>
            <Text
              style={{
                color: isCompleted
                  ? '#22c55e'
                  : isNext
                  ? theme.accent
                  : theme.textSub,
                fontWeight: '700',
                fontSize: 15,
              }}
            >
              {formatTo12Hour(prayer.time)}
            </Text>
            {isNext && !isCompleted && (
              <Text style={{ color: theme.accent + '99', fontSize: 10, letterSpacing: 0.8, marginTop: 2 }}>
                NEXT
              </Text>
            )}
            {isCompleted && (
              <Text style={{ color: 'rgba(34,197,94,0.7)', fontSize: 10, letterSpacing: 0.8, marginTop: 2 }}>
                DONE
              </Text>
            )}
          </View>
          {canToggle && (
            <DoneButton done={isCompleted} onPress={onToggle!} darkBg={false} />
          )}
        </View>
      </View>
    </View>
  );
}
