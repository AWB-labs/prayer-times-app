import type { AzkarId } from '../types/azkar';

export type AthkarStackParamList = {
  AthkarList: undefined;
  AthkarReader: { azkarId: AzkarId };
};

export type QuranStackParamList = {
  QuranList: undefined;
  QuranReader: { surahNumber: number };
};

/**
 * Settings sits outside the tab bar so the Quran can take its tab slot. It is
 * pushed from the gear in the home screen header instead.
 */
export type RootStackParamList = {
  Tabs: undefined;
  Settings: undefined;
};
