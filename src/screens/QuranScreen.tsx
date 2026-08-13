import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useSurahList } from '../hooks/useQuran';
import type { SurahMeta } from '../services/quranApi';
import type { QuranStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme';

/** Fixed so `getItemLayout` can be supplied for the 114-row list. */
const ROW_HEIGHT = 72;

/**
 * Harakat U+064B–U+065F, annotation marks U+0610–U+061A and U+06D6–U+06ED,
 * superscript alef U+0670, tatweel U+0640. Spelled out because combining marks
 * inside a character class reorder on screen in an otherwise left-to-right
 * file, so the range this matches cannot be read off the source.
 */
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/**
 * Folds an Arabic string down to what a phone keyboard can actually produce.
 *
 * The corpus names are fully vocalised and spelled with the alef wasla U+0671,
 * neither of which anyone types into a search box, so the marks are dropped and
 * the alef, ya and ta marbuta variants are folded on both sides of the compare.
 */
function foldArabic(value: string): string {
  return value
    .replace(ARABIC_MARKS, '')
    .replace(/[آأإٱ]/g, 'ا') // alef variants -> U+0627
    .replace(/ة/g, 'ه') // ta marbuta -> U+0647
    .replace(/ى/g, 'ي'); // alef maqsura -> U+064A
}

/** Folded form of سورة, the word every name in the surah list starts with. */
const SURAH_WORD = 'سوره';

/**
 * That leading word is noise once it repeats down 114 rows, so it is dropped for
 * display only — search still matches against the full name. Compared folded
 * because the corpus vocalises it and its final letter differs by surah.
 */
function shortArabicName(name: string): string {
  const [first, ...rest] = name.split(' ');
  return rest.length > 0 && foldArabic(first) === SURAH_WORD ? rest.join(' ') : name;
}

interface SurahRowProps {
  surah: SurahMeta;
  theme: AppTheme;
  onPress: () => void;
}

function SurahRow({ surah, theme, onPress }: SurahRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Surah ${surah.number}, ${surah.englishName}, ${surah.numberOfAyahs} ayahs`}
      style={{
        height: ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        <View
          style={{
            position: 'absolute',
            width: 30,
            height: 30,
            borderRadius: 7,
            borderWidth: 1,
            borderColor: theme.accentBorder,
            backgroundColor: theme.accentSurface,
            transform: [{ rotate: '45deg' }],
          }}
        />
        <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '700' }}>
          {surah.number}
        </Text>
      </View>

      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text numberOfLines={1} style={{ color: theme.text, fontSize: 16, fontWeight: '600' }}>
          {surah.englishName}
        </Text>
        <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 12, marginTop: 3 }}>
          {surah.englishNameTranslation} · {surah.revelationType} · {surah.numberOfAyahs} ayahs
        </Text>
      </View>

      {/* Explicit line box — the vocalised name's damma clips at the platform
          default line height. Fits the fixed 72px row. */}
      <Text style={{ color: theme.accent, fontSize: 18, lineHeight: 32 }}>
        {shortArabicName(surah.name)}
      </Text>
    </TouchableOpacity>
  );
}

export function QuranScreen() {
  const { theme } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<QuranStackParamList, 'QuranList'>>();
  const { data, loading, error, refetch } = useSurahList();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const list = data ?? [];
    const trimmed = query.trim();
    if (!trimmed) return list;

    const lower = trimmed.toLowerCase();
    const folded = foldArabic(trimmed);

    return list.filter(
      (surah) =>
        String(surah.number).startsWith(trimmed) ||
        surah.englishName.toLowerCase().includes(lower) ||
        surah.englishNameTranslation.toLowerCase().includes(lower) ||
        foldArabic(surah.name).includes(folded)
    );
  }, [data, query]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {/* Outside the list, so typing can never remount it and drop focus. */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: 42,
            borderRadius: 12,
            paddingHorizontal: 12,
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or number"
            placeholderTextColor={theme.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search surahs"
            style={{
              flex: 1,
              marginLeft: 8,
              padding: 0,
              color: theme.text,
              fontSize: 15,
            }}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery('')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ActivityIndicator color={theme.accent} size="large" />
          <Text style={{ color: theme.textMuted, marginTop: 12, fontSize: 13 }}>
            Loading surahs…
          </Text>
        </View>
      ) : error ? (
        <View style={{ paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 }}>
          <Ionicons name="warning-outline" size={36} color={theme.textMuted} />
          <Text
            style={{
              color: theme.textSub,
              marginTop: 10,
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            {error}
          </Text>
          <TouchableOpacity onPress={refetch} style={{ marginTop: 14 }} accessibilityRole="button">
            <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>
              Try again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(surah) => String(surah.number)}
          renderItem={({ item }) => (
            <SurahRow
              surah={item}
              theme={theme}
              onPress={() =>
                navigation.navigate('QuranReader', { surahNumber: item.number })
              }
            />
          )}
          getItemLayout={(_, index) => ({
            length: ROW_HEIGHT,
            offset: ROW_HEIGHT * index,
            index,
          })}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListEmptyComponent={
            <View style={{ paddingVertical: 48, alignItems: 'center', paddingHorizontal: 24 }}>
              <Ionicons name="search-outline" size={30} color={theme.textMuted} />
              <Text style={{ color: theme.textSub, marginTop: 10, fontSize: 13 }}>
                No surah matches “{query.trim()}”
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}
