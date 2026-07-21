import React, { useState } from 'react';
import {
  View,
  Text,
  Switch,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

import { useTheme } from '../context/ThemeContext';
import { useLocationContext } from '../context/LocationContext';
import { LocationPickerScreen } from './LocationPickerScreen';
import { useNotificationPrefs, NotificationMode } from '../context/NotificationPrefsContext';
import { STREAK_PRAYERS, StreakPrayerName } from '../context/PrayerLogContext';

interface RowProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}

function Row({ icon, iconColor, label, sublabel, right, onPress }: RowProps) {
  const { theme } = useTheme();

  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: iconColor + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 1 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      {right ?? (
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

function SectionHeader({ label }: { label: string }) {
  const { theme } = useTheme();
  return (
    <Text
      style={{
        color: theme.textMuted,
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 6,
      }}
    >
      {label}
    </Text>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        marginHorizontal: 16,
        borderRadius: 16,
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function Divider() {
  const { theme } = useTheme();
  return (
    <View
      style={{
        height: 1,
        backgroundColor: theme.border,
        marginLeft: 66,
      }}
    />
  );
}

const MODES: { value: NotificationMode; icon: string }[] = [
  { value: 'off', icon: '✕' },
  { value: 'silent', icon: '🔕' },
  { value: 'vibration', icon: '📳' },
  { value: 'sound', icon: '🔔' },
];

const PRAYER_ICONS: Record<StreakPrayerName, string> = {
  Fajr: '🌙',
  Dhuhr: '☀️',
  Asr: '🌤',
  Maghrib: '🌇',
  Isha: '🌃',
};

function ModeSelector({
  prayer,
  mode,
  onSelect,
}: {
  prayer: StreakPrayerName;
  mode: NotificationMode;
  onSelect: (mode: NotificationMode) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <TouchableOpacity
            key={m.value}
            onPress={() => onSelect(m.value)}
            activeOpacity={0.7}
            style={{
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 8,
              backgroundColor: active ? theme.accent : theme.border,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 34,
            }}
          >
            <Text style={{ fontSize: 14 }}>{m.icon}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function SettingsScreen() {
  const { theme, toggleTheme } = useTheme();
  const { manualLocation, clearManualLocation } = useLocationContext();
  const { prefs, setPrayerMode, setAthkarEnabled } = useNotificationPrefs();
  const [pickerVisible, setPickerVisible] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.statusBar} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* ── Page title ── */}
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }}>
            <Text style={{ color: theme.text, fontSize: 28, fontWeight: '800' }}>
              Settings
            </Text>
            <Text style={{ color: theme.textSub, fontSize: 13, marginTop: 3 }}>
              Customize your experience
            </Text>
          </View>

          {/* ── Location picker modal ── */}
          <LocationPickerScreen
            visible={pickerVisible}
            initialCoords={manualLocation ?? undefined}
            onClose={() => setPickerVisible(false)}
          />

          {/* ── Location ── */}
          <SectionHeader label="Location" />
          <Card>
            <Row
              icon="location"
              iconColor="#e05c5c"
              label="Custom Location"
              sublabel={
                manualLocation
                  ? manualLocation.cityName
                    ? `📍 ${manualLocation.cityName}`
                    : `${manualLocation.latitude.toFixed(3)}°, ${manualLocation.longitude.toFixed(3)}°`
                  : 'Using automatic GPS'
              }
              onPress={() => setPickerVisible(true)}
            />
            {manualLocation && (
              <>
                <Divider />
                <Row
                  icon="navigate-outline"
                  iconColor={theme.textMuted}
                  label="Reset to GPS"
                  sublabel="Remove the manual pin and use device location"
                  onPress={clearManualLocation}
                  right={<Ionicons name="refresh-outline" size={16} color={theme.textMuted} />}
                />
              </>
            )}
          </Card>

          {/* ── Appearance ── */}
          <SectionHeader label="Appearance" />
          <Card>
            <Row
              icon={theme.isDark ? 'moon' : 'sunny'}
              iconColor={theme.accent}
              label="Theme"
              sublabel={theme.isDark ? 'Dark mode' : 'Light mode'}
              right={
                <Switch
                  value={theme.isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#c4c4c4', true: theme.accent + 'aa' }}
                  thumbColor={theme.isDark ? theme.accent : '#f4f4f4'}
                  ios_backgroundColor="#c4c4c4"
                />
              }
            />
          </Card>

          {/* ── Notifications ── */}
          <SectionHeader label="Notifications" />
          <Card>
            {STREAK_PRAYERS.map((prayer, index) => (
              <React.Fragment key={prayer}>
                <Row
                  icon="notifications-outline"
                  iconColor={theme.accent}
                  label={`${PRAYER_ICONS[prayer]}  ${prayer}`}
                  right={
                    <ModeSelector
                      prayer={prayer}
                      mode={prefs.prayers[prayer]}
                      onSelect={(mode) => setPrayerMode(prayer, mode)}
                    />
                  }
                />
                {index < STREAK_PRAYERS.length - 1 && <Divider />}
              </React.Fragment>
            ))}
            <Divider />
            <Row
              icon="book-outline"
              iconColor="#b05fc4"
              label="Athkar Reminders"
              sublabel="Pre & post prayer adhkar"
              right={
                <Switch
                  value={prefs.athkarEnabled}
                  onValueChange={setAthkarEnabled}
                  trackColor={{ false: '#c4c4c4', true: theme.accent + 'aa' }}
                  thumbColor={prefs.athkarEnabled ? theme.accent : '#f4f4f4'}
                  ios_backgroundColor="#c4c4c4"
                />
              }
            />
          </Card>

          {/* ── App info ── */}
          <SectionHeader label="App" />
          <Card>
            <Row
              icon="information-circle-outline"
              iconColor={theme.textSub}
              label="Version"
              sublabel="1.0.0"
              right={<View />}
            />
          </Card>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
