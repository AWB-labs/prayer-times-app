/**
 * On-disk cache for Quran text, so a surah opened once stays readable offline.
 *
 * Uses the `File`/`Directory` class API from `expo-file-system` rather than the
 * legacy function API. Note that legacy names such as `readAsStringAsync` are
 * still exported from the bare `expo-file-system` specifier but throw on call —
 * reaching them needs `expo-file-system/legacy`, which this module does not.
 *
 * Storage lives under the document directory, not the cache directory: the
 * whole point is that an already-read surah survives, and iOS purges
 * `Library/Caches` under disk pressure. The cost is that the ~3.5 MB worst case
 * (all 114 surahs) is included in device backups; excluding it needs a native
 * `isExcludedFromBackup` flag, which expo-file-system 19 does not expose to JS.
 *
 * One file per surah, not one file for the corpus. Al-Baqara is the largest at
 * ~240 KB, so both the synchronous `File.write` and the `JSON.parse` on read
 * stay small enough not to stall the JS thread.
 */

import { Directory, File, Paths } from 'expo-file-system';
import { Surah, SurahAudio, SurahMeta } from './quranApi';

/**
 * Bump when any cached shape changes. Files stamped with an older version read
 * as a miss and are overwritten by the next fetch, so a shape change can never
 * surface as a half-old, half-new record.
 */
export const CACHE_SCHEMA_VERSION = 2;

const CACHE_DIR = new Directory(Paths.document, 'quran-cache');

interface CacheEnvelope<T> {
  schema: number;
  /** Epoch ms, for cache-age display and eviction decisions. */
  savedAt: number;
  payload: T;
}

/** Edition identifiers reach filenames, so anything path-like is neutralised. */
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, '_');

const surahFileName = (surahNumber: number) => `surah-${surahNumber}.json`;

const audioFileName = (surahNumber: number, reciter: string) =>
  `audio-${surahNumber}-${safeName(reciter)}.json`;

const SURAH_LIST_FILE = 'surah-list.json';

function ensureDir(): void {
  if (!CACHE_DIR.exists) {
    CACHE_DIR.create({ intermediates: true, idempotent: true });
  }
}

/**
 * Reads one envelope, treating every failure as a miss.
 *
 * A cache is an optimisation, so nothing in here may throw: a truncated write,
 * a schema bump, a file deleted underneath us and a revoked permission all
 * resolve to null and send the caller to the network.
 */
async function readEnvelope<T>(fileName: string): Promise<T | null> {
  try {
    const file = new File(CACHE_DIR, fileName);
    if (!file.exists) return null;

    const parsed: CacheEnvelope<T> = JSON.parse(await file.text());
    if (parsed?.schema !== CACHE_SCHEMA_VERSION) return null;

    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

/**
 * `File.write` is synchronous in expo-file-system 19 and this wrapper is async
 * only so callers need not change if that ever moves off the JS thread.
 * Failures are swallowed for the same reason reads are: a full disk should not
 * break reading a surah that was fetched successfully.
 */
async function writeEnvelope<T>(fileName: string, payload: T): Promise<void> {
  try {
    ensureDir();

    const envelope: CacheEnvelope<T> = {
      schema: CACHE_SCHEMA_VERSION,
      savedAt: Date.now(),
      payload,
    };

    const file = new File(CACHE_DIR, fileName);
    file.create({ intermediates: true, overwrite: true });
    file.write(JSON.stringify(envelope));
  } catch {
    // Nothing to do — the caller already has the data it wanted to cache.
  }
}

/* ── Surah list ─────────────────────────────────────────────────────────── */

export async function readCachedSurahList(): Promise<SurahMeta[] | null> {
  const list = await readEnvelope<SurahMeta[]>(SURAH_LIST_FILE);

  // A short list means a partial write got through JSON.parse intact; the
  // corpus is fixed at 114 surahs, so anything else is not usable.
  return Array.isArray(list) && list.length === 114 ? list : null;
}

export async function writeCachedSurahList(list: SurahMeta[]): Promise<void> {
  await writeEnvelope(SURAH_LIST_FILE, list);
}

/* ── Surah text ─────────────────────────────────────────────────────────── */

export async function readCachedSurah(surahNumber: number): Promise<Surah | null> {
  const surah = await readEnvelope<Surah>(surahFileName(surahNumber));
  if (!surah) return null;

  // Guards a surah truncated mid-write: the declared count is the API's, so a
  // short `ayahs` array means the file never finished.
  const complete =
    Array.isArray(surah.ayahs) &&
    surah.ayahs.length === surah.numberOfAyahs &&
    surah.number === surahNumber;

  return complete ? surah : null;
}

export async function writeCachedSurah(surah: Surah): Promise<void> {
  await writeEnvelope(surahFileName(surah.number), surah);
}

/* ── Audio URLs ─────────────────────────────────────────────────────────── */

/**
 * Only the URL manifest is cached, never the mp3s. It is ~2.8 KB per surah and
 * is what makes an offline device able to resolve a playlist at all.
 */
export async function readCachedSurahAudio(
  surahNumber: number,
  reciter: string
): Promise<SurahAudio | null> {
  const audio = await readEnvelope<SurahAudio>(audioFileName(surahNumber, reciter));
  if (!audio) return null;

  return Array.isArray(audio.ayahs) && audio.ayahs.length > 0 ? audio : null;
}

export async function writeCachedSurahAudio(audio: SurahAudio): Promise<void> {
  await writeEnvelope(audioFileName(audio.surahNumber, audio.reciter), audio);
}

/* ── Maintenance ────────────────────────────────────────────────────────── */

export interface QuranCacheStats {
  /** Number of cached files, across all editions and reciters. */
  fileCount: number;
  /** Total bytes on disk. */
  bytes: number;
}

export async function getQuranCacheStats(): Promise<QuranCacheStats> {
  try {
    if (!CACHE_DIR.exists) return { fileCount: 0, bytes: 0 };

    const files = CACHE_DIR.list().filter((entry): entry is File => entry instanceof File);

    return {
      fileCount: files.length,
      bytes: files.reduce((total, file) => total + file.size, 0),
    };
  } catch {
    return { fileCount: 0, bytes: 0 };
  }
}

/** Drops everything. Intended for a "clear offline data" settings action. */
export async function clearQuranCache(): Promise<void> {
  try {
    if (CACHE_DIR.exists) CACHE_DIR.delete();
  } catch {
    // Already gone, or unreadable — either way there is nothing to clear.
  }
}
