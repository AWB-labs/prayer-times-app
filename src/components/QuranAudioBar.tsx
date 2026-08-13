import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { RECITERS, SurahAudio, pickAudioUrl } from '../services/quranApi';
import { useTheme } from '../context/ThemeContext';

/** Fixed rather than intrinsic so the list above it never reflows mid-scroll. */
const BAR_HEIGHT = 66;

export interface QuranAudioBarProps {
  /** Arabic surah name, used as the lock-screen album line. */
  surahName: string;
  surahEnglishName: string;
  /** Bounds prev/next before the URL manifest has arrived. */
  ayahCount: number;
  audio: SurahAudio | null;
  audioLoading: boolean;
  audioError: string | null;
  /**
   * Retries the recitation manifest. Without it a failed manifest is terminal:
   * the load effect can never run, so play does nothing and reconnecting does
   * not help — the only escapes would be changing reciter or leaving the screen.
   */
  onRetryAudio: () => void;
  reciter: string;
  onChangeReciter: (identifier: string) => void;
  dataSaver: boolean;
  onChangeDataSaver: (enabled: boolean) => void;
  /**
   * Index into the surah's ayahs that is cued for playback, or null for idle.
   * The bar is controlled: it never moves this itself, it asks the parent to,
   * so the reader's highlight and auto-scroll cannot drift out of sync with
   * what is actually sounding.
   */
  activeIndex: number | null;
  onActiveIndexChange: (index: number | null) => void;
  /**
   * Bumped by the reader on every explicit play request. Asking for the ayah
   * that is already cued does not change `activeIndex`, so without this the
   * press would be swallowed and pressing ▶ on a paused ayah would do nothing.
   */
  playRequestId: number;
}

export function QuranAudioBar({
  surahName,
  surahEnglishName,
  ayahCount,
  audio,
  audioLoading,
  audioError,
  onRetryAudio,
  reciter,
  onChangeReciter,
  dataSaver,
  onChangeDataSaver,
  activeIndex,
  onActiveIndexChange,
  playRequestId,
}: QuranAudioBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);

  const reciterLabel =
    RECITERS.find((r) => r.identifier === reciter)?.label ?? reciter;

  // Built once with a null source. `useAudioPlayer` keys its native object on
  // the source argument, so passing the current ayah's URL would destroy and
  // rebuild the player — and drop the lock-screen session — on every advance.
  // Tracks are swapped with `replace()` below instead.
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  /** Whether the reader wants sound, as opposed to what the player is doing. */
  const intentRef = useRef<'playing' | 'paused'>('paused');
  const loadedRef = useRef<{ index: number; url: string } | null>(null);
  const finishedRef = useRef(false);
  /**
   * Whether the lock-screen session is already installed.
   *
   * `setActiveForLockScreen` installs a session rather than updating one: on
   * Android it releases and rebuilds the MediaSession and reposts the
   * notification, and on iOS it re-registers the remote-command handlers, which
   * accumulate because they are added as closures and cannot be removed. Calling
   * it once per ayah would do that 286 times over Al-Baqarah. Subsequent
   * advances go through `updateLockScreenMetadata` instead.
   */
  const lockScreenActiveRef = useRef(false);
  const lastPlayRequestRef = useRef(playRequestId);

  // Read from the completion effect, which must not re-subscribe on every ayah.
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;
  const ayahCountRef = useRef(ayahCount);
  ayahCountRef.current = ayahCount;

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {
      // Only background and silent-switch playback are lost; recitation still
      // works with the app in front, which is not worth an error to the reader.
    });
  }, []);

  useEffect(() => {
    if (activeIndex === null) {
      player.pause();
      // The surah has ended or playback was dropped, so the now-playing entry
      // goes with it. Both platforms no-op this when no session is active.
      player.clearLockScreenControls();
      lockScreenActiveRef.current = false;
      intentRef.current = 'paused';
      loadedRef.current = null;
      return;
    }

    // Nothing to load until the manifest lands; this effect reruns when it does.
    const ayah = audio?.ayahs[activeIndex];
    if (!ayah) return;

    const url = pickAudioUrl(ayah, dataSaver);
    const loaded = loadedRef.current;

    const isReplayRequest = playRequestId !== lastPlayRequestRef.current;
    lastPlayRequestRef.current = playRequestId;

    if (loaded && loaded.index === activeIndex && loaded.url === url) {
      // Same ayah, same source. Only an explicit press means anything here, and
      // it means "start this one again" — including after a pause.
      if (isReplayRequest) {
        intentRef.current = 'playing';
        finishedRef.current = false;
        player.seekTo(0).catch(() => {});
        player.play();
      }
      return;
    }

    // Moving to a different ayah is always a request to hear it. The same ayah
    // at a new URL is a reciter or bitrate switch, which must not resume a
    // player the reader deliberately paused.
    if (!loaded || loaded.index !== activeIndex) intentRef.current = 'playing';

    loadedRef.current = { index: activeIndex, url };
    finishedRef.current = false;

    player.replace({ uri: url });

    const metadata = {
      title: `${surahEnglishName} · Ayah ${ayah.numberInSurah}`,
      artist: reciterLabel,
      albumTitle: surahName,
    };
    if (lockScreenActiveRef.current) {
      player.updateLockScreenMetadata(metadata);
    } else {
      player.setActiveForLockScreen(true, metadata);
      lockScreenActiveRef.current = true;
    }

    // `replace()` carries over the previous playing state, and a track that has
    // just ended is paused — so continuous playback needs an explicit resume or
    // the queue stalls silently on the second ayah.
    if (intentRef.current === 'playing') player.play();
  }, [
    activeIndex,
    audio,
    dataSaver,
    player,
    playRequestId,
    reciterLabel,
    surahEnglishName,
    surahName,
  ]);

  useEffect(() => {
    // `didJustFinish` stays true across consecutive status emissions, so it is
    // latched until the next source is in place or the surah ends.
    if (!status.didJustFinish || finishedRef.current) return;
    finishedRef.current = true;

    const current = activeIndexRef.current;
    if (current === null) return;

    const next = current + 1;
    if (next < ayahCountRef.current) {
      onActiveIndexChange(next);
    } else {
      intentRef.current = 'paused';
      onActiveIndexChange(null);
    }
  }, [status.didJustFinish, onActiveIndexChange]);

  // The lock-screen session deliberately has no unmount hook: releasing the
  // player tears it down on both platforms, and `useAudioPlayer` registers that
  // release before any effect declared here — so a cleanup of ours would run
  // against an already-freed native object.

  const toggle = useCallback(() => {
    if (activeIndex === null) {
      intentRef.current = 'playing';
      onActiveIndexChange(0);
      return;
    }
    // Branches on intent, not `status.playing`. While a track is buffering the
    // player is not yet playing, so keying off status would treat a press meant
    // to cancel as a second request to play, and it would start anyway once the
    // buffer filled.
    if (intentRef.current === 'playing') {
      intentRef.current = 'paused';
      player.pause();
    } else {
      intentRef.current = 'playing';
      player.play();
    }
  }, [activeIndex, onActiveIndexChange, player]);

  const step = useCallback(
    (delta: number) => {
      if (activeIndex === null) return;
      const next = activeIndex + delta;
      if (next < 0 || next >= ayahCount) return;
      onActiveIndexChange(next);
    },
    [activeIndex, ayahCount, onActiveIndexChange]
  );

  const idle = activeIndex === null;
  // Gated on `!playing` so a mid-track stall never replaces the pause control
  // with a spinner the reader cannot press.
  const busy =
    !idle &&
    !audioError &&
    !status.playing &&
    (audioLoading || status.isBuffering || !status.isLoaded);
  const progress =
    status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  const ayahLabel = idle
    ? 'Tap play to begin the recitation'
    : `Ayah ${(audio?.ayahs[activeIndex]?.numberInSurah ?? activeIndex + 1)} of ${ayahCount}`;

  return (
    <View
      style={{
        height: BAR_HEIGHT,
        backgroundColor: theme.surface,
        borderTopWidth: 1,
        borderTopColor: theme.border,
      }}
    >
      {/* Progress through the current ayah, doubling as a buffering hint. */}
      <View style={{ height: 2, backgroundColor: theme.border }}>
        <View
          style={{
            width: `${Math.round(progress * 100)}%`,
            height: '100%',
            backgroundColor: theme.accent,
          }}
        />
      </View>

      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => setSheetOpen(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Reciter: ${reciterLabel}. Change reciter`}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: theme.accentSurface,
              borderWidth: 1,
              borderColor: theme.accentBorder,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 10,
            }}
          >
            <Ionicons
              name={audioError ? 'warning-outline' : 'mic-outline'}
              size={16}
              color={audioError ? theme.textMuted : theme.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              numberOfLines={1}
              style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}
            >
              {reciterLabel}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.textMuted, fontSize: 11, marginTop: 1 }}>
              {audioError ?? ayahLabel}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => step(-1)}
          disabled={idle || activeIndex === 0}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Previous ayah"
          style={{ padding: 6, opacity: idle || activeIndex === 0 ? 0.35 : 1 }}
        >
          <Ionicons name="play-skip-back" size={20} color={theme.textSub} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={audioError ? onRetryAudio : toggle}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={
            audioError
              ? 'Retry loading recitation'
              : status.playing
              ? 'Pause recitation'
              : 'Play recitation'
          }
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 6,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.accentFg} />
          ) : audioError ? (
            <Ionicons name="refresh" size={20} color={theme.accentFg} />
          ) : (
            <Ionicons
              name={status.playing ? 'pause' : 'play'}
              size={20}
              color={theme.accentFg}
              // The play triangle sits visually left of centre in a circle.
              style={{ marginLeft: status.playing ? 0 : 2 }}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => step(1)}
          disabled={idle || activeIndex >= ayahCount - 1}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          accessibilityRole="button"
          accessibilityLabel="Next ayah"
          style={{
            padding: 6,
            opacity: idle || activeIndex >= ayahCount - 1 ? 0.35 : 1,
          }}
        >
          <Ionicons name="play-skip-forward" size={20} color={theme.textSub} />
        </TouchableOpacity>
      </View>

      <Modal
        visible={sheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSheetOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setSheetOpen(false)}
          />
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
                Reciter
              </Text>
              <TouchableOpacity
                onPress={() => setSheetOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={20} color={theme.textSub} />
              </TouchableOpacity>
            </View>

            <ScrollView>
              {RECITERS.map((option) => {
                const selected = option.identifier === reciter;
                return (
                  <TouchableOpacity
                    key={option.identifier}
                    activeOpacity={0.7}
                    onPress={() => {
                      onChangeReciter(option.identifier);
                      setSheetOpen(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      backgroundColor: selected ? theme.accentSurface : 'transparent',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          color: selected ? theme.accent : theme.text,
                          fontSize: 15,
                          fontWeight: selected ? '600' : '400',
                        }}
                      >
                        {option.label}
                      </Text>
                      <Text style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
                        {option.arabicLabel}
                      </Text>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderTopWidth: 1,
                  borderTopColor: theme.border,
                  marginTop: 8,
                }}
              >
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={{ color: theme.text, fontSize: 15 }}>Data saver</Text>
                  <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
                    Use the lowest bitrate a reciter publishes
                  </Text>
                </View>
                <Switch
                  value={dataSaver}
                  onValueChange={onChangeDataSaver}
                  trackColor={{ false: theme.borderStrong, true: theme.accent + 'aa' }}
                  thumbColor={dataSaver ? theme.accent : theme.surface2}
                  ios_backgroundColor={theme.borderStrong}
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
