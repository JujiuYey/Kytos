import type { CharacterPortraitImage, CharacterPortraitTaskStatus } from './character-portrait';

export interface CharacterVisualReferenceImage {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
}

export interface GenerateCharacterVisualRequest {
  prompt: string;
  referenceImage?: CharacterVisualReferenceImage;
}

export interface GetCharacterVisualGenerationRequest {
  generationId: string;
}

export interface SaveCharacterVisualRequest {
  characterId?: string;
  generationId: string;
}

export interface SaveCharacterVisualResult {
  characterId: string;
  library: import('./character-library').CharacterLibraryState;
}

export interface CharacterVisualGeneration {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  image: CharacterPortraitImage | null;
  progress: number;
  status: CharacterPortraitTaskStatus;
  updatedAt: string;
}
