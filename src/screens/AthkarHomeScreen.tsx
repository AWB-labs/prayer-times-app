import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { AzkarId } from '../types/azkar';
import type { AthkarStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';

const CARDS: { id: AzkarId; subtitle: string; hint: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { id: 'sabah', subtitle: 'Morning remembrance', hint: 'أذكار الصباح', icon: 'sunny-outline' },
  { id: 'massa', subtitle: 'Evening remembrance', hint: 'أذكار المساء', icon: 'moon-outline' },
  { id: 'post', subtitle: 'After prayer', hint: 'أذكار بعد الصلاة', icon: 'heart-outline' },
];

export function AthkarHomeScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<AthkarStackParamList, 'AthkarList'>>();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ color: theme.textSub, fontSize: 13, marginBottom: 24, lineHeight: 22 }}>
        اختر مجموعة الأذكار. يمكنك أيضاً استخدام التنبيهات عند كل صلاة من
        إعدادات الجهاز بعد منح الإذن.
      </Text>

      {CARDS.map((card) => (
        <TouchableOpacity
          key={card.id}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('AthkarReader', { azkarId: card.id })}
          style={{
            marginBottom: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.surface,
            padding: 20,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <Ionicons name={card.icon} size={20} color={theme.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.accent, fontSize: 17, fontWeight: '600', textAlign: 'right' }}>
                {card.hint}
              </Text>
              <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                {card.subtitle}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }}>
            <Text style={{ color: theme.accent + 'cc', fontSize: 13, marginRight: 4 }}>Open</Text>
            <Ionicons name="arrow-forward" size={14} color={theme.accent + 'cc'} />
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
