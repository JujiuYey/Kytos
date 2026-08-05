import type { CharacterVisualImage } from '@/types';

export interface ImageReferencePickerFilter {
  label: string;
  value: string;
}

export interface ImageReferencePickerOption {
  detail: string;
  image: CharacterVisualImage;
  key: string;
  label: string;
  source: string;
}
