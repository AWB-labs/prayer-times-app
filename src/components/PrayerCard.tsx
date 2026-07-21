import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Prayer } from '../types';
import { formatTo12Hour } from '../utils/prayerUtils';
import { useTheme } from '../context/ThemeContext';
import { STREAK_PRAYERS, StreakPrayerName } from '../context/PrayerLogContext';

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

export function PrayerCard({ prayer, isCurrent, isNext, isCompleted = false, onToggle }: Props) {
  const { theme } = useTheme();
  const canToggle = isStreakPrayer(prayer.name) && !!onToggle;

  // Resolve state-driven colours from semantic tokens (no raw hex here).
  const bg = isCompleted ? theme.successSurface : isNext ? theme.surface2 : theme.surface;
  const border = isCompleted ? theme.successBorder : isNext ? theme.accentBorder : theme.border;
  const chipBg = isCompleted ? theme.successSurface : isNext ? theme.accentSurface : theme.border;
  const iconColor = isCompleted ? theme.success : isNext ? theme.accent : theme.textSub;
  const nameColor = isCompleted ? theme.success : isNext ? theme.text : theme.textSub;
  const timeColor = isCompleted ? theme.success : isNext ? theme.accent : theme.textSub;

  const tag = isCompleted ? 'DONE' : isNext ? 'NEXT' : isCurrent ? 'NOW' : null;
  const tagColor = isCompleted ? theme.success : theme.accent;

  const Container: any = canToggle ? TouchableOpacity : View;
  const containerProps = canToggle
    ? {
        onPress: onToggle,
        activeOpacity: 0.7,
        accessibilityRole: 'button' as const,
        accessibilityState: { checked: isCompleted },
        accessibilityLabel: `${prayer.name} ${formatTo12Hour(prayer.time)}, ${
          isCompleted ? 'completed' : 'not completed'
        }`,
      }
    : {};

  return (
    <Container
      {...containerProps}
      style={{
        marginHorizontal: 16,
        marginBottom: 8,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: chipBg,
          }}
        >
          <MaterialCommunityIcons name={prayer.icon as any} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: nameColor, fontWeight: '600', fontSize: 15 }}>{prayer.name}</Text>
          <Text style={{ color: theme.textMuted, fontSize: 11.5 }}>{prayer.arabicName}</Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: timeColor, fontWeight: '700', fontSize: 15, fontVariant: ['tabular-nums'] }}>
            {formatTo12Hour(prayer.time)}
          </Text>
          {tag && (
            <Text style={{ color: tagColor, fontSize: 9.5, letterSpacing: 1, fontWeight: '700', marginTop: 2 }}>
              {tag}
            </Text>
          )}
        </View>

        {canToggle && (
          <View
            pointerEvents="none"
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: isCompleted ? theme.success : 'transparent',
              borderWidth: 2,
              borderColor: isCompleted ? theme.success : theme.textMuted,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isCompleted && <Ionicons name="checkmark" size={15} color="#ffffff" />}
          </View>
        )}
      </View>
    </Container>
  );
}
