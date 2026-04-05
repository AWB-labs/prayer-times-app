import React, { useLayoutEffect } from 'react';
import { View, Text, FlatList } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

import { azkarById } from '../data/azkarIndex';
import type { AzkarItem } from '../types/azkar';
import type { AthkarStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';

function ZekrBlock({ item, index, theme }: { item: AzkarItem; index: number; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={{ marginBottom: 24, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <View style={{ backgroundColor: theme.accentSurface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text style={{ color: theme.accent, fontSize: 12 }}>×{item.repeat}</Text>
        </View>
        <Text style={{ color: theme.textMuted, fontSize: 12 }}>#{index + 1}</Text>
      </View>
      <Text style={{ color: theme.text, fontSize: 18, lineHeight: 32, textAlign: 'right' }}>
        {item.zekr}
      </Text>
      {item.bless ? (
        <Text style={{ color: '#34d399', fontSize: 13, marginTop: 12, lineHeight: 22, textAlign: 'right' }}>
          {item.bless}
        </Text>
      ) : null}
    </View>
  );
}

export function AthkarReaderScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AthkarStackParamList, 'AthkarReader'>>();
  const { azkarId } = route.params;
  const collection = azkarById[azkarId];

  useLayoutEffect(() => {
    navigation.setOptions({ title: collection.title });
  }, [navigation, collection.title]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <FlatList
        data={collection.content}
        keyExtractor={(_, i) => `${azkarId}-${i}`}
        renderItem={({ item, index }) => (
          <ZekrBlock item={item} index={index} theme={theme} />
        )}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
