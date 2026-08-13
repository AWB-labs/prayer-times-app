import React from 'react';
import { View, ScrollView, Text, RefreshControl, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/types';
import { useLocation } from '../hooks/useLocation';
import { usePrayerTimes } from '../hooks/usePrayerTimes';
import { usePrayerNotifications } from '../hooks/usePrayerNotifications';
import { buildPrayerList, getCurrentAndNextPrayer } from '../utils/prayerUtils';
import { useTheme } from '../context/ThemeContext';
import { usePrayerLogContext, StreakPrayerName, STREAK_PRAYERS } from '../context/PrayerLogContext';
import { getDateString } from '../hooks/useStreak';

import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen } from '../components/ErrorScreen';
import { DateHeader } from '../components/DateHeader';
import { NextPrayerBanner } from '../components/NextPrayerBanner';
import { StreakStrip } from '../components/StreakStrip';
import { PrayerCard } from '../components/PrayerCard';

/**
 * Settings no longer has a tab — the Quran took that slot — so this is the only
 * way into it. It is rendered over the loading and error states too: a user
 * whose location lookup fails needs Settings to pin a location manually, and
 * stranding them on the error screen would leave the app unusable.
 */
function SettingsButton() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      accessibilityRole="button"
      accessibilityLabel="Settings"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={{
        position: 'absolute',
        top: insets.top + 6,
        right: 16,
        zIndex: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.border,
      }}
    >
      <Ionicons name="settings-outline" size={18} color={theme.textSub} />
    </TouchableOpacity>
  );
}

export function PrayerHomeScreen() {
  const { theme } = useTheme();
  const location = useLocation();
  const prayerTimes = usePrayerTimes(location.latitude, location.longitude);
  const { isPrayerDone, togglePrayer } = usePrayerLogContext();
  const today = getDateString();

  usePrayerNotifications(location.latitude, location.longitude, prayerTimes.data);

  const isLoading = location.loading || prayerTimes.loading;
  const error = location.error || prayerTimes.error;

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = React.useCallback(() => {
    setRefreshing(true);
    prayerTimes.refetch();
    setTimeout(() => setRefreshing(false), 1500);
  }, [prayerTimes]);

  if (isLoading) {
    return (
      <>
        <StatusBar style={theme.statusBar} />
        <SettingsButton />
        <LoadingScreen
          message={location.loading ? 'Getting your location...' : 'Loading prayer times...'}
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        <StatusBar style={theme.statusBar} />
        <SettingsButton />
        <ErrorScreen message={error} onRetry={prayerTimes.refetch} />
      </>
    );
  }

  if (!prayerTimes.data) return null;

  const prayers = buildPrayerList(prayerTimes.data.timings);
  const { currentIndex, nextIndex } = getCurrentAndNextPrayer(prayers);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.statusBar} />
      <SettingsButton />
      {/* Bottom inset is already handled by the tab bar — claiming it here too
          would leave a strip of `theme.bg` sitting above the navigation bar. */}
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.accent}
              colors={[theme.accent]}
            />
          }
        >
          <DateHeader date={prayerTimes.data.date} cityName={location.cityName} />
          <NextPrayerBanner prayers={prayers} nextIndex={nextIndex} />
          <StreakStrip />

          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Text style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginHorizontal: 12 }}>
              Today's Prayers
            </Text>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
          </View>

          {prayers.map((prayer, index) => {
            const canTrack = (STREAK_PRAYERS as readonly string[]).includes(prayer.name);
            return (
              <PrayerCard
                key={prayer.name}
                prayer={prayer}
                isCurrent={index === currentIndex}
                isNext={index === nextIndex}
                isCompleted={canTrack ? isPrayerDone(today, prayer.name as StreakPrayerName) : false}
                onToggle={canTrack ? () => togglePrayer(today, prayer.name as StreakPrayerName) : undefined}
              />
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
