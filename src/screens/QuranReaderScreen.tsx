import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSurah, useSurahAudio } from '../hooks/useQuran';
import {
  DEFAULT_RECITER,
  DEFAULT_TRANSLATION,
  QuranAyah,
  RECITERS,
  Surah,
  TRANSLATION_EDITIONS,
  getTranslationEdition,
} from '../services/quranApi';
import { QuranAudioBar } from '../components/QuranAudioBar';
import type { QuranStackParamList } from '../navigation/types';
import { useTheme } from '../context/ThemeContext';
import type { AppTheme } from '../theme';

const PREFS_KEY = '@quran_reader_prefs_v1';

const MIN_FONT_SIZE = 18;
const MAX_FONT_SIZE = 44;
const FONT_STEP = 2;

/** Uthmani script needs close to twice its point size to clear the marks. */
const ARABIC_LINE_HEIGHT_RATIO = 1.95;

/**
 * Wraps text in an explicit right-to-left embedding.
 *
 * `writingDirection` is declared on TextStyleIOS only and has no Android
 * implementation, so on Android the paragraph direction is inferred from the
 * first strong character. That is right for most verses but wrong for any line
 * opening with a Latin word — a transliterated name or a bracketed gloss — which
 * would lay out left-to-right while still right-aligned. U+202B/U+202C pins the
 * direction on both platforms.
 */
const rtlEmbed = (text: string) => `‫${text}‬`;

const clampFontSize = (size: number) =>
  Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.round(size)));

interface ReaderPrefs {
  translation: string;
  reciter: string;
  showTranslation: boolean;
  arabicFontSize: number;
  dataSaver: boolean;
}

const DEFAULT_PREFS: ReaderPrefs = {
  translation: DEFAULT_TRANSLATION,
  reciter: DEFAULT_RECITER,
  showTranslation: true,
  arabicFontSize: 26,
  dataSaver: false,
};

/**
 * Reading these is async, and the edition is a fetch key — starting on the
 * default would pull en.sahih down and then immediately discard it for whatever
 * the reader actually chose last time. `loaded` exists so the caller can hold
 * the fetch until the real edition is known.
 *
 * Identifiers are re-validated against the curated lists on the way in: one
 * dropped from a later release must not survive in storage, because the API
 * answers an unknown edition with a silent substitution rather than an error.
 */
function useReaderPrefs() {
  const [prefs, setPrefs] = useState<ReaderPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<ReaderPrefs>;
        setPrefs((prev) => ({
          translation:
            typeof saved.translation === 'string' && getTranslationEdition(saved.translation)
              ? saved.translation
              : prev.translation,
          reciter:
            typeof saved.reciter === 'string' &&
            RECITERS.some((r) => r.identifier === saved.reciter)
              ? saved.reciter
              : prev.reciter,
          showTranslation: saved.showTranslation ?? prev.showTranslation,
          arabicFontSize:
            typeof saved.arabicFontSize === 'number'
              ? clampFontSize(saved.arabicFontSize)
              : prev.arabicFontSize,
          dataSaver: saved.dataSaver ?? prev.dataSaver,
        }));
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  // Persisted from an effect rather than inside the updater: state updaters must
  // be pure, and React invokes them twice in development, which would double
  // every write.
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs)).catch(() => {});
  }, [prefs, loaded]);

  const updatePrefs = useCallback((patch: Partial<ReaderPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...patch }));
  }, []);

  return { prefs, prefsLoaded: loaded, updatePrefs };
}

function MetaPill({
  icon,
  label,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  theme: AppTheme;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: theme.surface2,
      }}
    >
      <Ionicons name={icon} size={12} color={theme.textSub} />
      <Text style={{ color: theme.textSub, fontSize: 11, marginLeft: 5 }}>{label}</Text>
    </View>
  );
}

function SurahHeader({
  surah,
  fontSize,
  theme,
}: {
  surah: Surah;
  fontSize: number;
  theme: AppTheme;
}) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.accentBorder,
          backgroundColor: theme.surface,
          paddingVertical: 18,
          paddingHorizontal: 16,
          alignItems: 'center',
        }}
      >
        {/* Explicit line box: these are fully vocalised names, and the platform
            default (~1.2x) clips the damma above the final letter. */}
        <Text
          style={{
            color: theme.accent,
            fontSize: 24,
            lineHeight: 24 * ARABIC_LINE_HEIGHT_RATIO,
            textAlign: 'center',
          }}
        >
          {surah.name}
        </Text>
        <Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginTop: 8 }}>
          {surah.englishName}
        </Text>
        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
          {surah.englishNameTranslation}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <MetaPill icon="compass-outline" label={surah.revelationType} theme={theme} />
          <MetaPill icon="list-outline" label={`${surah.numberOfAyahs} ayahs`} theme={theme} />
        </View>
      </View>

      {/*
        Rendered here only when the API lifted it out of ayah 1. Al-Fatiha keeps
        it as a numbered ayah of its own and At-Tawba has none, so both arrive
        with `basmala: null` and neither shows it twice.
      */}
      {surah.basmala !== null && (
        <Text
          style={{
            color: theme.text,
            fontSize: fontSize * 0.9,
            lineHeight: fontSize * 0.9 * ARABIC_LINE_HEIGHT_RATIO,
            textAlign: 'center',
            marginTop: 22,
            marginBottom: 2,
          }}
        >
          {surah.basmala}
        </Text>
      )}
    </View>
  );
}

function SajdaBadge({ obligatory, theme }: { obligatory: boolean; theme: AppTheme }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 9,
        paddingVertical: 3,
        backgroundColor: obligatory ? theme.accentSurface : theme.surface2,
        borderColor: obligatory ? theme.accentBorder : theme.border,
      }}
    >
      {/* U+06E9, the place-of-sajda mark used in printed mushafs. */}
      <Text style={{ color: obligatory ? theme.accent : theme.textSub, fontSize: 13 }}>۩</Text>
      <Text
        style={{
          color: obligatory ? theme.accent : theme.textSub,
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.4,
          marginLeft: 5,
          textTransform: 'uppercase',
        }}
      >
        {obligatory ? 'Sajda' : 'Sajda · recommended'}
      </Text>
    </View>
  );
}

interface AyahBlockProps {
  ayah: QuranAyah;
  theme: AppTheme;
  fontSize: number;
  showTranslation: boolean;
  translationDirection: 'rtl' | 'ltr';
  isPlaying: boolean;
  /** Row index, passed back to `onPlay` so the handler can stay identity-stable. */
  index: number;
  onPlay: (index: number) => void;
}

function AyahBlockBase({
  ayah,
  theme,
  fontSize,
  showTranslation,
  translationDirection,
  isPlaying,
  index,
  onPlay,
}: AyahBlockProps) {
  const translationFontSize = Math.max(13, Math.min(22, Math.round(fontSize * 0.58)));
  const handlePlay = useCallback(() => onPlay(index), [onPlay, index]);

  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        backgroundColor: isPlaying ? theme.accentSurface : 'transparent',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <TouchableOpacity
          onPress={handlePlay}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel={`Play from ayah ${ayah.numberInSurah}`}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <View
            style={{
              minWidth: 30,
              height: 24,
              borderRadius: 12,
              borderWidth: 1,
              paddingHorizontal: 8,
              alignItems: 'center',
              justifyContent: 'center',
              borderColor: isPlaying ? theme.accentBorder : theme.border,
              backgroundColor: isPlaying ? theme.accent : theme.surface,
            }}
          >
            <Text
              style={{
                color: isPlaying ? theme.accentFg : theme.textSub,
                fontSize: 11,
                fontWeight: '700',
              }}
            >
              {ayah.numberInSurah}
            </Text>
          </View>
          <Ionicons
            name={isPlaying ? 'volume-medium' : 'play-circle-outline'}
            size={16}
            color={isPlaying ? theme.accent : theme.textMuted}
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>

        {ayah.sajda && <SajdaBadge obligatory={ayah.sajda.obligatory} theme={theme} />}
      </View>

      <Text
        style={{
          color: theme.text,
          fontSize,
          lineHeight: fontSize * ARABIC_LINE_HEIGHT_RATIO,
          textAlign: 'right',
          writingDirection: 'rtl',
        }}
      >
        {rtlEmbed(ayah.arabic)}
      </Text>

      {showTranslation && ayah.translation.length > 0 && (
        <Text
          style={{
            color: theme.textSub,
            fontSize: translationFontSize,
            lineHeight: translationFontSize * 1.6,
            marginTop: 12,
            textAlign: translationDirection === 'rtl' ? 'right' : 'left',
            writingDirection: translationDirection,
          }}
        >
          {translationDirection === 'rtl' ? rtlEmbed(ayah.translation) : ayah.translation}
        </Text>
      )}
    </View>
  );
}

/**
 * Memoised because a continuous recitation changes `playingIndex` every few
 * seconds, and FlatList cells have no bail-out of their own — without this every
 * mounted ayah would re-render and re-measure its Arabic text on each advance,
 * when only the two rows either side of the boundary actually change.
 */
const AyahBlock = React.memo(AyahBlockBase);

interface ToolbarProps {
  theme: AppTheme;
  fontSize: number;
  onChangeFontSize: (size: number) => void;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  editionLabel: string;
  /** A new edition is in flight; the ayahs below are still the previous one. */
  editionLoading: boolean;
  onOpenEditions: () => void;
}

function ReaderToolbar({
  theme,
  fontSize,
  onChangeFontSize,
  showTranslation,
  onToggleTranslation,
  editionLabel,
  editionLoading,
  onOpenEditions,
}: ToolbarProps) {
  const stepper = (delta: number, icon: React.ComponentProps<typeof Ionicons>['name']) => {
    const next = clampFontSize(fontSize + delta);
    return (
      <TouchableOpacity
        onPress={() => onChangeFontSize(next)}
        disabled={next === fontSize}
        accessibilityRole="button"
        accessibilityLabel={delta > 0 ? 'Increase Arabic text size' : 'Decrease Arabic text size'}
        style={{
          width: 30,
          height: 30,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: next === fontSize ? 0.35 : 1,
        }}
      >
        <Ionicons name={icon} size={16} color={theme.textSub} />
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 34,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        {stepper(-FONT_STEP, 'remove')}
        <Text
          style={{
            color: theme.textSub,
            fontSize: 11,
            fontWeight: '600',
            width: 20,
            textAlign: 'center',
          }}
        >
          {fontSize}
        </Text>
        {stepper(FONT_STEP, 'add')}
      </View>

      <TouchableOpacity
        onPress={onToggleTranslation}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityState={{ checked: showTranslation }}
        accessibilityLabel="Show translation"
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: showTranslation ? theme.accentBorder : theme.border,
          backgroundColor: showTranslation ? theme.accentSurface : theme.surface,
        }}
      >
        <Ionicons
          name={showTranslation ? 'language' : 'language-outline'}
          size={16}
          color={showTranslation ? theme.accent : theme.textMuted}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onOpenEditions}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Translation: ${editionLabel}. Change translation`}
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          height: 34,
          borderRadius: 10,
          paddingHorizontal: 10,
          borderWidth: 1,
          borderColor: theme.border,
          backgroundColor: theme.surface,
        }}
      >
        <Text numberOfLines={1} style={{ flex: 1, color: theme.textSub, fontSize: 12 }}>
          {editionLabel}
        </Text>
        {editionLoading ? (
          <ActivityIndicator size="small" color={theme.textMuted} />
        ) : (
          <Ionicons name="chevron-down" size={14} color={theme.textMuted} />
        )}
      </TouchableOpacity>
    </View>
  );
}

function TranslationSheet({
  visible,
  selected,
  onSelect,
  onClose,
  theme,
}: {
  visible: boolean;
  selected: string;
  onSelect: (identifier: string) => void;
  onClose: () => void;
  theme: AppTheme;
}) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View
          style={{
            maxHeight: '75%',
            backgroundColor: theme.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            borderTopWidth: 1,
            borderColor: theme.border,
            paddingBottom: insets.bottom + 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: theme.border,
            }}
          >
            <Text style={{ flex: 1, color: theme.text, fontSize: 16, fontWeight: '700' }}>
              Translation
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={theme.textSub} />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {TRANSLATION_EDITIONS.map((edition) => {
              const isSelected = edition.identifier === selected;
              return (
                <TouchableOpacity
                  key={edition.identifier}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelect(edition.identifier);
                    onClose();
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 16,
                    paddingVertical: 13,
                    backgroundColor: isSelected ? theme.accentSurface : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: isSelected ? theme.accent : theme.text,
                        fontSize: 15,
                        fontWeight: isSelected ? '600' : '400',
                      }}
                    >
                      {edition.label}
                    </Text>
                    <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                      {edition.languageLabel}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function QuranReaderScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<QuranStackParamList, 'QuranReader'>>();
  const { surahNumber } = route.params;

  const { prefs, prefsLoaded, updatePrefs } = useReaderPrefs();
  const { data: surah, loading, error, refetch } = useSurah(
    prefsLoaded ? surahNumber : null,
    prefs.translation
  );

  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [editionsOpen, setEditionsOpen] = useState(false);
  /** Bumped on every explicit play press so the bar can restart the cued ayah. */
  const [playRequestId, setPlayRequestId] = useState(0);
  const listRef = useRef<FlatList<QuranAyah>>(null);
  const lastLoaded = useRef<Surah | null>(null);
  /** Cleared when the reader scrolls by hand; see the auto-scroll effect below. */
  const followPlaybackRef = useRef(true);

  // Idle until the reader asks for sound, so opening a surah to read never
  // spends a request on a recitation manifest.
  const audio = useSurahAudio(audioEnabled ? surahNumber : null, prefs.reciter);

  /*
   * Choosing a new translation re-keys the surah resource, which reports one
   * null frame before the new text lands. Rendering the previous copy through
   * that frame keeps the audio bar mounted, and with it the player — otherwise
   * changing edition mid-recitation would silence it. Only the translation
   * differs between editions; the Arabic and the ayah count are one corpus.
   *
   * The bridge is held open only while the fetch is in flight. If it fails, the
   * stale copy is dropped rather than left on screen under the new edition's
   * label, which would misattribute a translation to a translator.
   */
  // The bridged copy is kept through a FAILED switch too, not just a pending one.
  // Dropping it would tear down a working screen — toolbar, translation picker
  // and audio bar all unmount, stopping the recitation and leaving no way to pick
  // the edition that was working. The failure is surfaced inline instead.
  // Pinned to the surah actually being viewed, so a reused screen instance can
  // never bridge the previous surah's text under this one's header.
  const bridged =
    lastLoaded.current?.number === surahNumber ? lastLoaded.current : null;
  const shown = surah ?? bridged;
  const switchFailed = surah === null && error !== null && bridged !== null;

  // Committed in an effect rather than during render: a render that React throws
  // away must not leave the bridge pointing at a surah that was never shown.
  useEffect(() => {
    if (surah) lastLoaded.current = surah;
  }, [surah]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: shown ? shown.englishName : `Surah ${surahNumber}` });
  }, [navigation, shown, surahNumber]);

  useEffect(() => {
    if (playingIndex === null) return;
    // Reading ahead of the recitation is normal, so once the reader has scrolled
    // by hand the list stops chasing playback. Tapping an ayah is what asks to be
    // taken back to it.
    if (!followPlaybackRef.current) return;
    listRef.current?.scrollToIndex({
      index: playingIndex,
      animated: true,
      viewPosition: 0.25,
    });
  }, [playingIndex]);

  const handleActiveIndexChange = useCallback((index: number | null) => {
    if (index !== null) setAudioEnabled(true);
    setPlayingIndex(index);
  }, []);

  /** An ayah's own play button: cue it, resume following, and force a restart. */
  const handlePlayAyah = useCallback((index: number) => {
    followPlaybackRef.current = true;
    setPlayRequestId((n) => n + 1);
    setAudioEnabled(true);
    setPlayingIndex(index);
  }, []);

  // The edition the API actually answered with drives alignment, so a right-to-
  // left translation stays right-aligned even while a new one is on its way in.
  // Computed before the early returns below so the hooks that depend on it are
  // never skipped on a render.
  const translationDirection: 'rtl' | 'ltr' = shown
    ? shown.translationEdition.direction ??
      getTranslationEdition(shown.translationEdition.identifier)?.direction ??
      'ltr'
    : 'ltr';

  const renderAyah = useCallback(
    ({ item, index }: { item: QuranAyah; index: number }) => (
      <AyahBlock
        ayah={item}
        theme={theme}
        fontSize={prefs.arabicFontSize}
        showTranslation={prefs.showTranslation}
        translationDirection={translationDirection}
        isPlaying={index === playingIndex}
        index={index}
        onPlay={handlePlayAyah}
      />
    ),
    [
      theme,
      prefs.arabicFontSize,
      prefs.showTranslation,
      translationDirection,
      playingIndex,
      handlePlayAyah,
    ]
  );

  const ayahExtraData = useMemo(
    () => ({
      playingIndex,
      fontSize: prefs.arabicFontSize,
      showTranslation: prefs.showTranslation,
      translationDirection,
      theme,
    }),
    [playingIndex, prefs.arabicFontSize, prefs.showTranslation, translationDirection, theme]
  );

  if (!prefsLoaded || (loading && !shown)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: 48, alignItems: 'center' }}>
        <ActivityIndicator color={theme.accent} size="large" />
        <Text style={{ color: theme.textMuted, marginTop: 12, fontSize: 13 }}>
          Loading surah…
        </Text>
      </View>
    );
  }

  if (!shown) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          paddingTop: 48,
          paddingHorizontal: 24,
          alignItems: 'center',
        }}
      >
        <Ionicons name="warning-outline" size={36} color={theme.textMuted} />
        <Text
          style={{ color: theme.textSub, marginTop: 10, textAlign: 'center', fontSize: 13 }}
        >
          {error ?? 'This surah could not be loaded'}
        </Text>
        <TouchableOpacity onPress={refetch} style={{ marginTop: 14 }} accessibilityRole="button">
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Labelled from the edition actually on screen, not the one being fetched.
  // While a switch is in flight the previous translator's text is still rendered
  // below, and naming the new translator over it would misattribute a translation.
  const editionLabel =
    getTranslationEdition(shown.translationEdition.identifier)?.label ??
    shown.translationEdition.englishName;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ReaderToolbar
        theme={theme}
        fontSize={prefs.arabicFontSize}
        onChangeFontSize={(size) => updatePrefs({ arabicFontSize: size })}
        showTranslation={prefs.showTranslation}
        onToggleTranslation={() => updatePrefs({ showTranslation: !prefs.showTranslation })}
        editionLabel={editionLabel}
        editionLoading={loading}
        onOpenEditions={() => setEditionsOpen(true)}
      />

      {switchFailed && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: theme.surface,
            borderBottomWidth: 1,
            borderBottomColor: theme.border,
          }}
        >
          <Ionicons name="cloud-offline-outline" size={15} color={theme.textMuted} />
          <Text style={{ color: theme.textSub, fontSize: 12, flex: 1 }} numberOfLines={2}>
            Could not load that translation. Still showing {editionLabel}.
          </Text>
          <TouchableOpacity onPress={refetch} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={shown.ayahs}
        keyExtractor={(ayah) => String(ayah.number)}
        renderItem={renderAyah}
        // Only these change a row's appearance, and FlatList's cells have no
        // shouldComponentUpdate — without this the memoised rows would never
        // learn that the playing ayah moved.
        extraData={ayahExtraData}
        ListHeaderComponent={
          <SurahHeader surah={shown} fontSize={prefs.arabicFontSize} theme={theme} />
        }
        onScrollBeginDrag={() => {
          followPlaybackRef.current = false;
        }}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // Ayah heights vary far too much for getItemLayout, so a target that
          // has not been measured yet is approached by estimate instead. The
          // estimate ignores the header, so it is added back explicitly and the
          // real scroll retried once the row has been measured.
          listRef.current?.scrollToOffset({
            offset: index * averageItemLength,
            animated: true,
          });
          setTimeout(() => {
            if (!followPlaybackRef.current) return;
            listRef.current?.scrollToIndex({
              index,
              animated: true,
              viewPosition: 0.25,
            });
          }, 120);
        }}
        initialNumToRender={10}
        windowSize={9}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      />

      <QuranAudioBar
        surahName={shown.name}
        surahEnglishName={shown.englishName}
        ayahCount={shown.ayahs.length}
        audio={audio.data}
        audioLoading={audio.loading}
        audioError={audio.error}
        onRetryAudio={audio.refetch}
        reciter={prefs.reciter}
        onChangeReciter={(identifier) => updatePrefs({ reciter: identifier })}
        dataSaver={prefs.dataSaver}
        onChangeDataSaver={(enabled) => updatePrefs({ dataSaver: enabled })}
        activeIndex={playingIndex}
        onActiveIndexChange={handleActiveIndexChange}
        playRequestId={playRequestId}
      />

      <TranslationSheet
        visible={editionsOpen}
        selected={prefs.translation}
        onSelect={(identifier) => updatePrefs({ translation: identifier })}
        onClose={() => setEditionsOpen(false)}
        theme={theme}
      />
    </View>
  );
}
