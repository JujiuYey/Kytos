import type { CharacterPortraitImage } from '@/types';

export interface ImageReferencePickerFilter {
  label: string;
  value: string;
}

export interface ImageReferencePickerOption {
  detail: string;
  image: CharacterPortraitImage;
  key: string;
  label: string;
  source: string;
}
