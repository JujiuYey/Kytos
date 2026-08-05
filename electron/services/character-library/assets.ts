// 角色视觉资产元数据读取 + CharacterLibraryState 装配
import path from 'node:path';
import type {
  CharacterLibraryVisualAsset,
  CharacterLibraryState,
} from '../../../shared/character-library';
import { readJsonFile } from '../../storage/json-store';
import { getWorkspaceDirectory } from '../workspace';
import { LEGACY_VISUAL_STORE_FILE_NAME } from './constants';
import { parseCharacterVisualAsset } from './parsers';
import type { StoredCharacterLibrary } from './types';

export async function getCharacterVisualAsset(
  workspacePath: string,
  characterId: string,
): Promise<CharacterLibraryVisualAsset | null> {
  try {
    const value = await readJsonFile(
      path.join(workspacePath, 'characters', characterId, LEGACY_VISUAL_STORE_FILE_NAME),
    );
    return parseCharacterVisualAsset(value);
  } catch {
    return null;
  }
}

export async function toCharacterLibraryState(
  store: StoredCharacterLibrary,
): Promise<CharacterLibraryState> {
  const workspacePath = await getWorkspaceDirectory();
  const characters = await Promise.all(
    store.characters.map(async character => ({
      ...character,
      visualAsset: await getCharacterVisualAsset(workspacePath, character.id),
    })),
  );
  return { activeCharacterId: store.activeCharacterId, characters };
}
