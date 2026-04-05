import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  message: string;
  onRetry?: () => void;
}

export function ErrorScreen({ message, onRetry }: Props) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg, paddingHorizontal: 32 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>⚠️</Text>
      <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
        Something went wrong
      </Text>
      <Text style={{ color: theme.textSub, fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity
          onPress={onRetry}
          activeOpacity={0.8}
          style={{
            backgroundColor: theme.accent,
            paddingHorizontal: 32,
            paddingVertical: 12,
            borderRadius: 16,
          }}
        >
          <Text style={{ color: theme.accentFg, fontWeight: '700', fontSize: 15 }}>
            Try Again
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
