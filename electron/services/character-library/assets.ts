// 从角色视觉仓储装配 CharacterLibraryState
import type {
  CharacterLibraryVisualAsset,
  CharacterLibraryState,
} from '../../../shared/character-library';
import type { StoredCharacterLibrary } from './types';

export async function getCharacterVisualAsset(
  characterId: string,
): Promise<CharacterLibraryVisualAsset | null> {
  try {
    const { getCharacterVisualWorkspace } = await import('../character-visual');
    const workspace = await getCharacterVisualWorkspace(characterId);
    const officialKeys = new Set(
      workspace.officialAssets.map(asset => `${asset.taskId}:${asset.fileName}`),
    );
    for (const record of workspace.records) {
      const image = record.images.find(candidate =>
        officialKeys.has(`${record.id}:${candidate.fileName}`),
      );
      if (image) {
        return { name: image.name ?? record.name, size: record.size, url: image.url };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function toCharacterLibraryState(
  store: StoredCharacterLibrary,
): Promise<CharacterLibraryState> {
  const characters = await Promise.all(
    store.characters.map(async character => ({
      ...character,
      visualAsset: await getCharacterVisualAsset(character.id),
    })),
  );
  return { activeCharacterId: store.activeCharacterId, characters };
}
