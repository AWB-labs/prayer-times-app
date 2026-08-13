import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrayerHomeScreen } from '../screens/PrayerHomeScreen';
import { AthkarHomeScreen } from '../screens/AthkarHomeScreen';
import { AthkarReaderScreen } from '../screens/AthkarReaderScreen';
import { QuranScreen } from '../screens/QuranScreen';
import { QuranReaderScreen } from '../screens/QuranReaderScreen';
import { QiblaScreen } from '../screens/QiblaScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StreakScreen } from '../screens/StreakScreen';
import { useTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme';
import type {
  AthkarStackParamList,
  QuranStackParamList,
  RootStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();
const AthkarStack = createNativeStackNavigator<AthkarStackParamList>();
const QuranStack = createNativeStackNavigator<QuranStackParamList>();

function stackScreenOptions(theme: AppTheme) {
  return {
    headerStyle: { backgroundColor: theme.navHeader },
    headerTintColor: theme.text,
    headerTitleStyle: { fontWeight: '600' as const },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.bg },
  };
}

function AthkarStackNavigator() {
  const { theme } = useTheme();

  return (
    <AthkarStack.Navigator screenOptions={stackScreenOptions(theme)}>
      <AthkarStack.Screen
        name="AthkarList"
        component={AthkarHomeScreen}
        options={{ title: 'الأذكار' }}
      />
      <AthkarStack.Screen
        name="AthkarReader"
        component={AthkarReaderScreen}
        options={{ title: 'الأذكار' }}
      />
    </AthkarStack.Navigator>
  );
}

function QuranStackNavigator() {
  const { theme } = useTheme();

  return (
    <QuranStack.Navigator screenOptions={stackScreenOptions(theme)}>
      <QuranStack.Screen
        name="QuranList"
        component={QuranScreen}
        options={{ title: 'القرآن الكريم' }}
      />
      {/* The reader sets its own title to the surah once it has loaded. */}
      <QuranStack.Screen
        name="QuranReader"
        component={QuranReaderScreen}
        options={{ title: '' }}
      />
    </QuranStack.Navigator>
  );
}

function TabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.tabBg,
          borderTopColor: theme.border,
          height: 52 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
      }}
    >
      <Tab.Screen
        name="Prayers"
        component={PrayerHomeScreen}
        options={{
          title: 'Prayers',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Quran"
        component={QuranStackNavigator}
        options={{
          title: 'Quran',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="reader-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Qibla"
        component={QiblaScreen}
        options={{
          title: 'Qibla',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="compass-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Streak"
        component={StreakScreen}
        options={{
          title: 'Streak',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flame" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Athkar"
        component={AthkarStackNavigator}
        options={{
          title: 'Athkar',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="book-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Settings sits above the tab bar rather than in it: the Quran took its tab
 * slot, and six tabs is already the most that fits comfortably. It is pushed
 * from the gear in the home screen header.
 */
export function RootNavigator() {
  const { theme } = useTheme();

  return (
    <RootStack.Navigator screenOptions={stackScreenOptions(theme)}>
      <RootStack.Screen
        name="Tabs"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </RootStack.Navigator>
  );
}
