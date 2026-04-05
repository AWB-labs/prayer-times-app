export interface AzkarItem {
  zekr: string;
  repeat: number;
  bless: string;
}

export interface AzkarCollection {
  title: string;
  content: AzkarItem[];
}

export type AzkarId = 'sabah' | 'massa' | 'post';
