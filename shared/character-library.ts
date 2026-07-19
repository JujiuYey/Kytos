import type { CharacterImageSize } from './character-portrait';

export interface CharacterSummary {
  createdAt: string;
  id: string;
  name: string;
  updatedAt: string;
}

export interface CharacterLibraryVisualAsset {
  kind: 'portrait' | 'sheet';
  size: CharacterImageSize;
  url: string;
}

export interface CharacterLibraryCharacter extends CharacterSummary {
  visualAsset: CharacterLibraryVisualAsset | null;
}

export interface CharacterLibraryState {
  activeCharacterId: string;
  characters: CharacterLibraryCharacter[];
}

export interface CreateCharacterRequest {
  name: string;
}

export interface UpdateCharacterRequest {
  characterId: string;
  name: string;
}

export interface DeleteCharacterRequest {
  characterId: string;
}

export interface SelectCharacterRequest {
  characterId: string;
}
