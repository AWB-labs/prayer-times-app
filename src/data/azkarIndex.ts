import type { AzkarCollection } from '../types/azkar';

import sabah from './azkar_sabah.json';
import massa from './azkar_massa.json';
import post from './PostPrayer_azkar.json';

export const azkarById: Record<'sabah' | 'massa' | 'post', AzkarCollection> = {
  sabah: sabah as AzkarCollection,
  massa: massa as AzkarCollection,
  post: post as AzkarCollection,
};
