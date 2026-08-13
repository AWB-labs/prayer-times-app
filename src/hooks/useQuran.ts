import { useCallback, useEffect, useState } from 'react';

import {
  DEFAULT_RECITER,
  DEFAULT_TRANSLATION,
  Surah,
  SurahAudio,
  SurahMeta,
  fetchSurah,
  fetchSurahAudio,
  fetchSurahList,
} from '../services/quranApi';
import {
  readCachedSurah,
  readCachedSurahAudio,
  readCachedSurahList,
  writeCachedSurah,
  writeCachedSurahAudio,
  writeCachedSurahList,
} from '../services/quranCache';

export interface QuranResource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * State is keyed by the resource it describes so that switching surah or
 * translation cannot render the previous one's text for a frame: anything
 * stamped with a different key reads as "not loaded yet".
 */
interface ResourceState<T> {
  key: string;
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Cache-first with background revalidation.
 *
 * The revalidation is deliberately silent — it never raises `loading` again and
 * never reports its failure — because the cached copy is already on screen and
 * the corpus is immutable, so a failed refresh has nothing to tell the reader.
 * An error only surfaces when there is no cached copy to fall back on, which is
 * the only case where the screen would otherwise be blank.
 */
function useCachedResource<T>(
  enabled: boolean,
  resourceKey: string,
  readCache: () => Promise<T | null>,
  fetchFresh: () => Promise<T>,
  writeCache: (value: T) => Promise<void>,
  errorMessage: string
): QuranResource<T> {
  const [state, setState] = useState<ResourceState<T>>({
    key: '',
    data: null,
    loading: enabled,
    error: null,
  });
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const load = async () => {
      // Re-runs land here with the previous attempt's state still in place, so
      // without this a "Try again" press would leave the screen pixel-identical
      // and read as a dead button.
      setState((prev) => ({ ...prev, loading: true, error: null }));

      // Inside the try: a cache read that rejects would otherwise reject `load`
      // unobserved and leave the screen on a spinner with no reachable retry.
      let cached: T | null = null;
      try {
        cached = await readCache();
      } catch {
        // Unreadable cache is not a failure — the network path still runs.
      }
      if (cancelled) return;

      if (cached !== null) {
        setState({ key: resourceKey, data: cached, loading: false, error: null });
      }

      try {
        const fresh = await fetchFresh();
        if (cancelled) return;

        setState({ key: resourceKey, data: fresh, loading: false, error: null });
        await writeCache(fresh);
      } catch (err) {
        if (cancelled || cached !== null) return;

        // The caller's message is what the reader sees. Transport and shape
        // errors ("Quran API error: 502", "Ayah count mismatch in surah 2")
        // are diagnostics, not something to put in front of someone trying to
        // read Qur'an, so they go to the dev console instead.
        if (__DEV__ && err instanceof Error) {
          console.warn('[quran]', err.message);
        }
        setState({
          key: resourceKey,
          data: null,
          loading: false,
          error: errorMessage,
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [enabled, resourceKey, readCache, fetchFresh, writeCache, errorMessage, trigger]);

  const refetch = useCallback(() => setTrigger((t) => t + 1), []);

  if (!enabled) {
    return { data: null, loading: false, error: null, refetch };
  }

  // A key mismatch means the effect for the current resource has not settled
  // yet, so report the loading state rather than the previous resource's data.
  if (state.key !== resourceKey) {
    return { data: null, loading: true, error: null, refetch };
  }

  return { data: state.data, loading: state.loading, error: state.error, refetch };
}

/** Metadata for all 114 surahs. */
export function useSurahList(): QuranResource<SurahMeta[]> {
  return useCachedResource(
    true,
    'surah-list',
    readCachedSurahList,
    fetchSurahList,
    writeCachedSurahList,
    'Failed to load the surah list'
  );
}

/**
 * One surah's Arabic paired with a translation.
 *
 * @param surahNumber 1..114, or null to stay idle until the caller has one.
 */
export function useSurah(
  surahNumber: number | null,
  translationEdition: string = DEFAULT_TRANSLATION
): QuranResource<Surah> {
  const readCache = useCallback(
    (): Promise<Surah | null> =>
      surahNumber === null
        ? Promise.resolve(null)
        : readCachedSurah(surahNumber, translationEdition),
    [surahNumber, translationEdition]
  );

  const fetchFresh = useCallback(
    (): Promise<Surah> =>
      surahNumber === null
        ? Promise.reject(new Error('No surah selected'))
        : fetchSurah(surahNumber, translationEdition),
    [surahNumber, translationEdition]
  );

  const writeCache = useCallback(
    (surah: Surah) => writeCachedSurah(surah, translationEdition),
    [translationEdition]
  );

  return useCachedResource(
    surahNumber !== null,
    `surah-${surahNumber}-${translationEdition}`,
    readCache,
    fetchFresh,
    writeCache,
    'Failed to load the surah'
  );
}

/**
 * Per-ayah audio URLs for a surah. Only the URL manifest — the mp3s stream from
 * the CDN, which the reader should download separately if it offers offline
 * playback.
 */
export function useSurahAudio(
  surahNumber: number | null,
  reciter: string = DEFAULT_RECITER
): QuranResource<SurahAudio> {
  const readCache = useCallback(
    (): Promise<SurahAudio | null> =>
      surahNumber === null
        ? Promise.resolve(null)
        : readCachedSurahAudio(surahNumber, reciter),
    [surahNumber, reciter]
  );

  const fetchFresh = useCallback(
    (): Promise<SurahAudio> =>
      surahNumber === null
        ? Promise.reject(new Error('No surah selected'))
        : fetchSurahAudio(surahNumber, reciter),
    [surahNumber, reciter]
  );

  return useCachedResource(
    surahNumber !== null,
    `audio-${surahNumber}-${reciter}`,
    readCache,
    fetchFresh,
    writeCachedSurahAudio,
    'Failed to load the recitation'
  );
}
