export const CHARACTER_PORTRAIT_SIZES = ['2:3', '3:4', '4:5', '1:1'] as const;
export const CHARACTER_PORTRAIT_RESOLUTIONS = ['1k', '2k', '4k'] as const;

export type CharacterPortraitSize = (typeof CHARACTER_PORTRAIT_SIZES)[number];
export type CharacterPortraitResolution = (typeof CHARACTER_PORTRAIT_RESOLUTIONS)[number];
export type CharacterPortraitTaskStatus =
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GenerateCharacterPortraitRequest {
  count: number;
  prompt: string;
  resolution: CharacterPortraitResolution;
  size: CharacterPortraitSize;
}

export interface CharacterPortraitImage {
  fileName: string;
  mimeType: string;
  url: string;
}

export interface CharacterPortraitRecord extends GenerateCharacterPortraitRequest {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  images: CharacterPortraitImage[];
  progress: number;
  status: CharacterPortraitTaskStatus;
  updatedAt: string;
}

export interface CharacterPortraitSelection {
  fileName: string;
  taskId: string;
}

export interface CharacterPortraitWorkspaceState {
  records: CharacterPortraitRecord[];
  selectedImage: CharacterPortraitSelection | null;
}

export interface SelectCharacterPortraitRequest {
  fileName: string;
  taskId: string;
}
