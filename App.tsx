import './global.css';
import React, { useRef, useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WidgetBridge } from './src/modules/WidgetBridge';

import { ThemeProvider } from './src/context/ThemeContext';
import { LocationProvider } from './src/context/LocationContext';
import { PrayerLogProvider } from './src/context/PrayerLogContext';
import { NotificationPrefsProvider } from './src/context/NotificationPrefsContext';
import { RootNavigator } from './src/navigation/RootNavigator';

function WidgetForegroundSync() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active') {
        WidgetBridge.reloadAllTimelines().catch(() => {});
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, []);

  return null;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <WidgetForegroundSync />
      <SafeAreaProvider>
        <ThemeProvider>
          <LocationProvider>
            <PrayerLogProvider>
              <NotificationPrefsProvider>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </NotificationPrefsProvider>
            </PrayerLogProvider>
          </LocationProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
