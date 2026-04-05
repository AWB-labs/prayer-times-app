import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  message?: string;
}

export function LoadingScreen({ message = 'Getting your location...' }: Props) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
      <Text style={{ fontSize: 48, marginBottom: 24 }}>🕌</Text>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={{ color: theme.textSub, marginTop: 16, fontSize: 15, fontWeight: '300', letterSpacing: 0.5 }}>
        {message}
      </Text>
    </View>
  );
}
