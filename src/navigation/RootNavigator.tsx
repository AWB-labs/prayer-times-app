import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrayerHomeScreen } from '../screens/PrayerHomeScreen';
import { AthkarHomeScreen } from '../screens/AthkarHomeScreen';
import { AthkarReaderScreen } from '../screens/AthkarReaderScreen';
import { QiblaScreen } from '../screens/QiblaScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StreakScreen } from '../screens/StreakScreen';
import { useTheme } from '../context/ThemeContext';
import type { AthkarStackParamList } from './types';

const Tab = createBottomTabNavigator();
const AthkarStack = createNativeStackNavigator<AthkarStackParamList>();

function AthkarStackNavigator() {
  const { theme } = useTheme();
  const screenBase = {
    headerStyle: { backgroundColor: theme.navHeader },
    headerTintColor: theme.text,
    headerTitleStyle: { fontWeight: '600' as const },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.bg },
  };

  return (
    <AthkarStack.Navigator screenOptions={screenBase}>
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

export function RootNavigator() {
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
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
