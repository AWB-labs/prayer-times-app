/**
 * alquran.cloud client.
 *
 * Two things about this API shape the whole module:
 *
 * 1. An unknown edition identifier does not 404 — it returns 200 with a
 *    *different* edition silently substituted. A typo would therefore ship the
 *    wrong scripture with no error, so every response is checked against what
 *    was asked for.
 * 2. The Arabic text inlines the Basmala into ayah 1 of 113 of the 114 surahs,
 *    so rendering ayah 1 as-is repeats it under the header that already shows
 *    it. It is split off here, once, on the way in — see `splitBasmala`.
 */

const BASE_URL = 'https://api.alquran.cloud/v1';
const CDN_URL = 'https://cdn.islamic.network/quran';

/** The Uthmani script edition. Every ayah's Arabic comes from here. */
export const ARABIC_EDITION = 'quran-uthmani';

/* ── Raw API payloads ───────────────────────────────────────────────────── */

interface ApiResponse<T> {
  code: number;
  status: string;
  /** Becomes a plain string on error responses, so discriminate on `code`. */
  data: T;
}

export type RevelationType = 'Meccan' | 'Medinan';

export interface SurahMeta {
  number: number;
  /** Arabic name, including the leading word سُورَةُ */
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: RevelationType;
}

export interface EditionRef {
  identifier: string;
  language: string;
  name: string;
  englishName: string;
  format: 'text' | 'audio';
  type: 'quran' | 'translation' | 'transliteration' | 'tafsir' | 'versebyverse' | 'surahbysurah';
  /** Always null on audio editions. */
  direction: 'rtl' | 'ltr' | null;
}

/** The API returns `false` rather than null when an ayah carries no sajda. */
interface RawSajda {
  id: number;
  recommended: boolean;
  obligatory: boolean;
}

interface RawAyah {
  /** Global index 1..6236, *not* the index within the surah. */
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: false | RawSajda;
  /** Present only when the edition's format is `audio`. */
  audio?: string;
  audioSecondary?: string[];
}

interface RawSurahWithAyahs {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: RevelationType;
  numberOfAyahs: number;
  ayahs: RawAyah[];
  edition: EditionRef;
}

/* ── Normalised shapes the app consumes ─────────────────────────────────── */

export interface AyahSajda {
  id: number;
  /** Mutually exclusive with `recommended` across all 15 occurrences. */
  obligatory: boolean;
  recommended: boolean;
}

export interface QuranAyah {
  /** Global index 1..6236. Audio URLs are keyed off this, not surah:ayah. */
  number: number;
  numberInSurah: number;
  /** Uthmani script, with the leading Basmala already removed. */
  arabic: string;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: AyahSajda | null;
}

export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: RevelationType;
  numberOfAyahs: number;
  /**
   * The Basmala lifted out of ayah 1, to be rendered as a header above the
   * surah. Null for Al-Fatiha (where it is a numbered ayah in its own right)
   * and At-Tawba (which has none).
   */
  basmala: string | null;
  arabicEdition: EditionRef;
  ayahs: QuranAyah[];
}

/* ── Basmala ────────────────────────────────────────────────────────────── */

export const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ';

/**
 * Anchored to `^` deliberately: 27:30 quotes the Basmala mid-ayah, and a
 * replace-anywhere strip would delete it from scripture. The optional shadda
 * covers surahs 95 and 97, whose Basmala carries a spurious U+0651, and the
 * optional BOM covers 1:1, the only ayah that begins with U+FEFF.
 */
const BASMALA_RE =
  /^﻿?بّ?ِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/;

/**
 * Separates the Basmala from an ayah's Arabic text.
 *
 * Al-Fatiha is the exception that must not be stripped: 1:1 *is* the Basmala,
 * and removing it would leave an empty ayah and break the surah's 7-ayah count.
 */
export function splitBasmala(
  surahNumber: number,
  numberInSurah: number,
  text: string
): { basmala: string | null; text: string } {
  if (numberInSurah !== 1) return { basmala: null, text };
  if (surahNumber === 1) return { basmala: null, text: text.replace(/^﻿/, '') };
  if (surahNumber === 9) return { basmala: null, text };

  const stripped = text.replace(BASMALA_RE, '');
  return stripped === text ? { basmala: null, text } : { basmala: BASMALA, text: stripped };
}

/* ── Curated editions ───────────────────────────────────────────────────── */

export interface Reciter {
  identifier: string;
  label: string;
  arabicLabel: string;
}

/** Verse-by-verse reciters, all confirmed to return their own edition. */
export const RECITERS: Reciter[] = [
  { identifier: 'ar.alafasy', label: 'Mishary Alafasy', arabicLabel: 'مشاري العفاسي' },
  { identifier: 'ar.husary', label: 'Mahmoud Al-Husary', arabicLabel: 'محمود خليل الحصري' },
  { identifier: 'ar.husarymujawwad', label: 'Al-Husary (Mujawwad)', arabicLabel: 'الحصري (المجود)' },
  { identifier: 'ar.mahermuaiqly', label: 'Maher Al-Muaiqly', arabicLabel: 'ماهر المعيقلي' },
  { identifier: 'ar.abdulsamad', label: 'Abdul Basit Abdul Samad', arabicLabel: 'عبد الباسط عبد الصمد' },
  { identifier: 'ar.abdurrahmaansudais', label: 'Abdurrahman As-Sudais', arabicLabel: 'عبدالرحمن السديس' },
  { identifier: 'ar.shaatree', label: 'Abu Bakr Ash-Shaatree', arabicLabel: 'أبو بكر الشاطري' },
  { identifier: 'ar.hudhaify', label: 'Ali Al-Hudhaify', arabicLabel: 'علي الحذيفي' },
  { identifier: 'ar.saoodshuraym', label: 'Saood Ash-Shuraym', arabicLabel: 'سعود الشريم' },
  { identifier: 'ar.muhammadayyoub', label: 'Muhammad Ayyoub', arabicLabel: 'محمد أيوب' },
];

export const DEFAULT_RECITER = 'ar.alafasy';

/* ── Transport ──────────────────────────────────────────────────────────── */

/** Kong allows 12 req/s and answers a burst with 429 + `Retry-After`. */
const MAX_RATE_LIMIT_RETRIES = 2;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Deadline for a single request.
 *
 * React Native's `fetch` is XMLHttpRequest-backed with `timeout = 0`, so a
 * connection that is accepted and then never answered — captive portal, carrier
 * black-hole, hung origin — leaves the promise pending forever. The hook that
 * calls this would sit on a spinner with its retry button unreachable, because
 * that button only renders once loading has ended.
 */
const REQUEST_TIMEOUT_MS = 15000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetches and unwraps the standard envelope.
 *
 * Accept-Encoding is deliberately not set: OkHttp adds it and decompresses
 * transparently only while the app leaves the header alone. Setting it by hand
 * hands us raw gzip bytes that `response.json()` cannot parse.
 */
async function request<T>(path: string): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetchWithTimeout(`${BASE_URL}${path}`);

    // Checked before parsing: a 429 body is `{message, request_id}`, not the
    // envelope, so reading it as one would throw over the real cause.
    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfter = Number(response.headers.get('Retry-After')) || 1;
      await delay(retryAfter * 1000 + Math.random() * 250);
      continue;
    }

    if (!response.ok) {
      throw new Error(`Quran API error: ${response.status}`);
    }

    const json: ApiResponse<T> = await response.json();

    if (json.code !== 200) {
      throw new Error(`Quran API error: ${json.status}`);
    }

    return json.data;
  }
}

/**
 * Guards against the silent-substitution trap: the API answers an unknown
 * identifier with 200 and a fallback edition rather than an error.
 */
function assertEdition(actual: EditionRef, expected: string): void {
  if (actual.identifier !== expected) {
    throw new Error(
      `Quran API returned edition "${actual.identifier}" instead of "${expected}"`
    );
  }
}

/* ── Endpoints ──────────────────────────────────────────────────────────── */

/** All 114 surahs, metadata only (~19 KB). */
export async function fetchSurahList(): Promise<SurahMeta[]> {
  return request<SurahMeta[]>('/surah');
}

/** One surah, Arabic only. */
export async function fetchSurah(surahNumber: number): Promise<Surah> {
  const data = await request<RawSurahWithAyahs[]>(
    `/surah/${surahNumber}/editions/${ARABIC_EDITION}`
  );

  const [arabic] = data;

  if (!arabic) {
    throw new Error(`Quran API returned ${data.length} editions, expected 1`);
  }

  assertEdition(arabic.edition, ARABIC_EDITION);

  const splits = arabic.ayahs.map((ayah) =>
    splitBasmala(surahNumber, ayah.numberInSurah, ayah.text)
  );

  const ayahs: QuranAyah[] = arabic.ayahs.map((ayah, index) => ({
    number: ayah.number,
    numberInSurah: ayah.numberInSurah,
    arabic: splits[index].text,
    juz: ayah.juz,
    manzil: ayah.manzil,
    page: ayah.page,
    ruku: ayah.ruku,
    hizbQuarter: ayah.hizbQuarter,
    sajda: ayah.sajda === false ? null : ayah.sajda,
  }));

  return {
    number: arabic.number,
    name: arabic.name,
    englishName: arabic.englishName,
    englishNameTranslation: arabic.englishNameTranslation,
    revelationType: arabic.revelationType,
    numberOfAyahs: arabic.numberOfAyahs,
    basmala: splits.length > 0 ? splits[0].basmala : null,
    arabicEdition: arabic.edition,
    ayahs,
  };
}

/* ── Audio ──────────────────────────────────────────────────────────────── */

export interface AyahAudio {
  /** Global ayah number, matching `QuranAyah.number`. */
  number: number;
  numberInSurah: number;
  /** The reciter's primary bitrate. */
  url: string;
  /** Lower bitrates, if the reciter has any. Empty for single-bitrate ones. */
  fallbackUrls: string[];
}

export interface SurahAudio {
  surahNumber: number;
  reciter: string;
  ayahs: AyahAudio[];
}

/**
 * Per-ayah audio URLs for a whole surah (~2.8 KB).
 *
 * The URLs come from the API rather than being templated, because bitrate
 * availability is per-reciter with no universal value: Alafasy has 128 and 64,
 * As-Sudais 192 and 64, Ash-Shuraym only 64. A hardcoded bitrate 403s for
 * whole reciters.
 */
export async function fetchSurahAudio(
  surahNumber: number,
  reciter: string = DEFAULT_RECITER
): Promise<SurahAudio> {
  const data = await request<RawSurahWithAyahs>(`/surah/${surahNumber}/${reciter}`);

  assertEdition(data.edition, reciter);

  const ayahs: AyahAudio[] = data.ayahs.map((ayah) => ({
    number: ayah.number,
    numberInSurah: ayah.numberInSurah,
    url: ayah.audio ?? '',
    fallbackUrls: ayah.audioSecondary ?? [],
  }));

  const missing = ayahs.find((a) => !a.url);
  if (missing) {
    throw new Error(`Reciter "${reciter}" returned no audio for ayah ${missing.number}`);
  }

  return { surahNumber, reciter, ayahs };
}

/**
 * Picks the URL to stream. `fallbackUrls` is ordered lowest bitrate first, so
 * data-saver takes the head and falls back to the primary for reciters that
 * publish only one bitrate.
 */
export function pickAudioUrl(ayah: AyahAudio, dataSaver: boolean): string {
  return dataSaver ? ayah.fallbackUrls[0] ?? ayah.url : ayah.url;
}

/**
 * Direct CDN URL for one ayah.
 *
 * Prefer `fetchSurahAudio` — it reports the bitrates a reciter actually has.
 * This exists for re-deriving a URL from an already-known-good bitrate, for
 * example when naming or re-resolving a downloaded file.
 */
export function buildAyahAudioUrl(
  globalAyahNumber: number,
  reciter: string,
  bitrate: number
): string {
  return `${CDN_URL}/audio/${bitrate}/${reciter}/${globalAyahNumber}.mp3`;
}
