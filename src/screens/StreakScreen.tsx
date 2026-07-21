import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '../context/ThemeContext';
import {
  usePrayerLogContext,
  STREAK_PRAYERS,
  StreakPrayerName,
} from '../context/PrayerLogContext';
import {
  useStreak,
  streakMessage,
  GridDay,
  getDateString,
} from '../hooks/useStreak';

/* ── Constants ──────────────────────────────────────────────────────────── */

const SCREEN_W = Dimensions.get('window').width;
const GRID_PADDING = 16;
const CELL_GAP = 5;
const CELL_SIZE = Math.floor((SCREEN_W - GRID_PADDING * 2 - CELL_GAP * 6) / 7);

const PRAYER_ARABIC: Record<StreakPrayerName, string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

const PRAYER_ICON: Record<StreakPrayerName, string> = {
  Fajr: 'weather-sunset-up',
  Dhuhr: 'white-balance-sunny',
  Asr: 'weather-partly-cloudy',
  Maghrib: 'weather-sunset-down',
  Isha: 'weather-night',
};

const WEEK_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/* ── Grid cell colour based on 0-5 completion ──────────────────────────── */
function cellColor(count: number, accent: string, isDark: boolean): string {
  if (count === 0) return isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
  if (count <= 2) return accent + '44';
  if (count <= 4) return accent + '88';
  return accent;
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function SectionLabel({ text }: { text: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        color: theme.textMuted,
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        marginHorizontal: 16,
        marginTop: 28,
        marginBottom: 10,
      }}
    >
      {text}
    </Text>
  );
}

/** Large fire card with streak number */
function FireCard({ streak }: { streak: number }) {
  const { theme } = useTheme();
  const msg = streakMessage(streak);
  const fireColor = streak > 0 ? theme.flame : theme.textMuted;

  return (
    <View
      style={{
        marginHorizontal: 16,
        borderRadius: 24,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: streak > 0 ? theme.flame + '40' : theme.border,
        padding: 28,
        alignItems: 'center',
        // Glow when active
        shadowColor: streak > 0 ? theme.flame : 'transparent',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: streak > 0 ? 0.25 : 0,
        shadowRadius: 20,
        elevation: streak > 0 ? 8 : 0,
      }}
    >
      {/* Flame icon */}
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: streak > 0 ? theme.flame + '22' : theme.border,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
          borderWidth: 2,
          borderColor: streak > 0 ? theme.flame + '50' : theme.border,
        }}
      >
        <Ionicons
          name="flame"
          size={48}
          color={fireColor}
        />
      </View>

      {/* Streak number */}
      <Text
        style={{
          color: streak > 0 ? fireColor : theme.textMuted,
          fontSize: 64,
          fontWeight: '900',
          lineHeight: 68,
          letterSpacing: -2,
        }}
      >
        {streak}
      </Text>
      <Text style={{ color: theme.textSub, fontSize: 16, fontWeight: '600', marginTop: 2 }}>
        {streak === 1 ? 'day streak' : 'days streak'}
      </Text>

      {/* Divider */}
      <View style={{ width: 40, height: 2, borderRadius: 1, backgroundColor: theme.border, marginVertical: 14 }} />

      {/* Motivational message */}
      <Text style={{ color: theme.textMuted, fontSize: 13, textAlign: 'center' }}>
        {msg}
      </Text>
    </View>
  );
}

/** Today's 5 prayer toggle pills */
function TodayPrayers() {
  const { theme } = useTheme();
  const { togglePrayer, isPrayerDone } = usePrayerLogContext();
  const today = getDateString();

  return (
    <View style={{ marginHorizontal: 16 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {STREAK_PRAYERS.map((prayer) => {
          const done = isPrayerDone(today, prayer);
          return (
            <TouchableOpacity
              key={prayer}
              onPress={() => togglePrayer(today, prayer)}
              activeOpacity={0.75}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 14,
                backgroundColor: done ? theme.accent + '20' : theme.surface,
                borderWidth: 1.5,
                borderColor: done ? theme.accent : theme.border,
                gap: 7,
              }}
            >
              <MaterialCommunityIcons
                name={PRAYER_ICON[prayer] as any}
                size={17}
                color={done ? theme.accent : theme.textSub}
              />

              <View>
                <Text
                  style={{
                    color: done ? theme.accent : theme.text,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {prayer}
                </Text>
                <Text style={{ color: theme.textMuted, fontSize: 10 }}>
                  {PRAYER_ARABIC[prayer]}
                </Text>
              </View>

              {/* Check indicator */}
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: done ? theme.accent : 'transparent',
                  borderWidth: done ? 0 : 1.5,
                  borderColor: theme.textMuted,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 2,
                }}
              >
                {done && (
                  <Ionicons name="checkmark" size={13} color={theme.accentFg} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** 5-week contribution grid */
function ContributionGrid({ grid }: { grid: GridDay[] }) {
  const { theme } = useTheme();

  // Split into 5 rows of 7
  const rows: GridDay[][] = [];
  for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));

  // Determine which weekday column index today falls on (for the header labels)
  const todayDow = new Date().getDay(); // 0=Sun

  return (
    <View style={{ marginHorizontal: GRID_PADDING }}>
      {/* Weekday headers aligned to today's column */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {WEEK_LABELS.map((label, i) => {
          const isToday = i === todayDow;
          return (
            <View
              key={i}
              style={{ width: CELL_SIZE, marginRight: i < 6 ? CELL_GAP : 0, alignItems: 'center' }}
            >
              <Text
                style={{
                  color: isToday ? theme.accent : theme.textMuted,
                  fontSize: 10,
                  fontWeight: isToday ? '700' : '400',
                }}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Grid rows */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', marginBottom: CELL_GAP }}>
          {row.map((day, ci) => (
            <View
              key={ci}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 6,
                marginRight: ci < 6 ? CELL_GAP : 0,
                backgroundColor: cellColor(day.count, theme.accent, theme.isDark),
                borderWidth: day.isToday ? 2 : 0,
                borderColor: day.isToday ? theme.accent : 'transparent',
              }}
            />
          ))}
        </View>
      ))}

      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 }}>
        <Text style={{ color: theme.textMuted, fontSize: 10 }}>Less</Text>
        {[0, 2, 3, 4, 5].map((count) => (
          <View
            key={count}
            style={{
              width: CELL_SIZE * 0.75,
              height: CELL_SIZE * 0.75,
              borderRadius: 4,
              backgroundColor: cellColor(count, theme.accent, theme.isDark),
            }}
          />
        ))}
        <Text style={{ color: theme.textMuted, fontSize: 10 }}>More</Text>
      </View>
    </View>
  );
}

/** Stat card */
function StatCard({
  icon,
  iconColor,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  value: string | number;
  label: string;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 16,
        padding: 16,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          backgroundColor: iconColor + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={{ color: theme.text, fontSize: 24, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: theme.textMuted, fontSize: 11, marginTop: 3, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

/* ── Main screen ────────────────────────────────────────────────────────── */

export function StreakScreen() {
  const { theme } = useTheme();
  const { currentStreak, bestStreak, todayCount, totalPrayers, grid } =
    useStreak();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.statusBar} />
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {/* ── Page title ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="flame" size={26} color={theme.flame} />
              <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>
                Prayer Streak
              </Text>
            </View>
            <Text style={{ color: theme.textSub, fontSize: 13, marginTop: 3 }}>
              Mark each prayer to keep your streak alive
            </Text>
          </View>

          {/* ── Fire card ── */}
          <FireCard streak={currentStreak} />

          {/* ── Today's prayers ── */}
          <SectionLabel text={`Today · ${todayCount}/5 prayers`} />
          <TodayPrayers />

          {/* ── 5-week contribution grid ── */}
          <SectionLabel text="Last 5 Weeks" />
          <ContributionGrid grid={grid} />

          {/* ── Stats ── */}
          <SectionLabel text="Statistics" />
          <View style={{ flexDirection: 'row', marginHorizontal: 16, gap: 12 }}>
            <StatCard
              icon="trophy"
              iconColor="#f59e0b"
              value={bestStreak}
              label="Best streak"
            />
            <StatCard
              icon="moon"
              iconColor="#6c8ebf"
              value={totalPrayers.toLocaleString()}
              label="Total prayers"
            />
          </View>

          <View style={{ flexDirection: 'row', marginHorizontal: 16, gap: 12, marginTop: 12 }}>
            <StatCard
              icon="today-outline"
              iconColor="#5ba85a"
              value={`${todayCount}/5`}
              label="Today's prayers"
            />
            <StatCard
              icon="flame"
              iconColor={theme.flame}
              value={currentStreak}
              label="Current streak"
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
