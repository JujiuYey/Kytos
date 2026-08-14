import type { CharacterVisualImage } from '@/types';
import type { IllustrationReferencePurpose } from '@/types';

export interface ImageReferencePickerFilter {
  label: string;
  value: string;
}

export interface ImageReferencePickerOption {
  detail: string;
  image: CharacterVisualImage;
  key: string;
  label: string;
  purpose?: IllustrationReferencePurpose;
  source: string;
}
