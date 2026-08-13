import type { ImagePickerAsset } from 'expo-image-picker';

export type ProfilePhotoDraft = ImagePickerAsset & {
  draftId: string;
  storagePath?: string;
};
