import type { ImagePickerAsset } from 'expo-image-picker';

import type { Database } from '@/types/database';

export type ProfilePhotoDraft = ImagePickerAsset & {
  draftId: string;
  reviewStatus?: Database['public']['Enums']['profile_review_status'];
  storagePath?: string;
};
