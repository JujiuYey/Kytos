// character-library 模块内部类型
import type {
  CharacterLibraryVisualAsset,
  CharacterSummary,
} from '../../../shared/character-library';

export interface StoredCharacterLibrary {
  activeCharacterId: string;
  characters: CharacterSummary[];
  version: 2;
}

export interface VisualAssetCandidate {
  asset: CharacterLibraryVisualAsset;
  createdAt: string;
}
