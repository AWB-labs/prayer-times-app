import React from 'react';
import { View, ScrollView, Text, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { PrayerCard } from '../components/PrayerCard';

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
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 32 }}
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

          <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 16 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: theme.border }} />
            <Text style={{ color: theme.textMuted, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginHorizontal: 12 }}>
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

          <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 16, letterSpacing: 0.5 }}>
            Calculation: {prayerTimes.data.meta.method.name}
          </Text>
          <Text style={{ textAlign: 'center', color: theme.textMuted, fontSize: 11, marginTop: 4 }}>
            {prayerTimes.data.meta.timezone}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
