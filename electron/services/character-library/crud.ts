// character-library 公共 API：workspace 查询 / CRUD / active directory
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { isPlainObject } from 'es-toolkit';
import type {
  CharacterLibraryState,
  CharacterSummary,
  CreateCharacterRequest,
  DeleteCharacterRequest,
  SelectCharacterRequest,
  UpdateCharacterRequest,
} from '../../../shared/character-library';
import { writeJsonFile } from '../../storage/json-store';
import { getWorkspaceDirectory } from '../workspace';
import { getCharacterVisualAsset, toCharacterLibraryState } from './assets';
import { CHARACTER_DIRECTORY, MAX_NAME_LENGTH } from './constants';
import { updateCharacterDraftName } from './legacy';
import { buildNewCharacter, loadStore, mutateStore } from './store';

export async function getCharacterLibrary(): Promise<CharacterLibraryState> {
  return toCharacterLibraryState(await loadStore());
}

export async function getActiveCharacterDirectory(): Promise<string> {
  const store = await loadStore();
  return getCharacterDirectory(store.activeCharacterId);
}

export async function getCharacterDirectory(characterId: string): Promise<string> {
  const store = await loadStore();
  const character = findCharacter(store, characterId);
  return path.join(await getWorkspaceDirectory(), CHARACTER_DIRECTORY, character.id);
}

export async function createCharacter(
  request: CreateCharacterRequest,
): Promise<CharacterLibraryState> {
  if (!isPlainObject(request)) {
    throw new Error('角色概要无效');
  }
  const name = normalizeCharacterName(request.name);
  const workspacePath = await getWorkspaceDirectory();
  const store = await mutateStore(async existing => {
    const character = buildNewCharacter(name);
    const characterDir = path.join(workspacePath, CHARACTER_DIRECTORY, character.id);
    await mkdir(characterDir, { recursive: true });
    await writeJsonFile(path.join(characterDir, 'character-draft.json'), { name });
    return {
      ...existing,
      activeCharacterId: character.id,
      characters: [character, ...existing.characters],
    };
  });
  return toCharacterLibraryState(store);
}

export async function prepareCharacterVisualSave(characterId: string): Promise<string> {
  const workspacePath = await getWorkspaceDirectory();
  const currentStore = await loadStore();
  const character = findCharacter(currentStore, characterId);
  if (await getCharacterVisualAsset(workspacePath, character.id)) {
    throw new Error('这个角色已经有正式视觉，请前往角色视觉继续管理');
  }
  const store = await mutateStore(existing => {
    const target = findCharacter(existing, characterId);
    return { ...existing, activeCharacterId: target.id };
  });
  return store.activeCharacterId;
}

export async function deleteCharacter(
  request: DeleteCharacterRequest,
): Promise<CharacterLibraryState> {
  const store = await mutateStore(existing => {
    findCharacter(existing, request?.characterId);
    if (existing.characters.length === 1) {
      throw new Error('至少保留一个角色');
    }
    const characters = existing.characters.filter(
      character => character.id !== request.characterId,
    );
    const activeCharacterId =
      existing.activeCharacterId === request.characterId
        ? characters[0].id
        : existing.activeCharacterId;
    return { ...existing, activeCharacterId, characters };
  });
  return toCharacterLibraryState(store);
}

export async function selectCharacter(
  request: SelectCharacterRequest,
): Promise<CharacterLibraryState> {
  const store = await mutateStore(existing => {
    const character = findCharacter(existing, request?.characterId);
    return { ...existing, activeCharacterId: character.id };
  });
  return toCharacterLibraryState(store);
}

export async function updateCharacter(
  request: UpdateCharacterRequest,
): Promise<CharacterLibraryState> {
  if (!isPlainObject(request)) {
    throw new Error('角色概要无效');
  }
  const name = normalizeCharacterName(request.name);
  const workspacePath = await getWorkspaceDirectory();
  const store = await mutateStore(async existing => {
    const target = findCharacter(existing, request.characterId);
    await updateCharacterDraftName(workspacePath, target.id, name);
    return {
      ...existing,
      characters: existing.characters.map(character =>
        character.id === target.id
          ? { ...character, name, updatedAt: new Date().toISOString() }
          : character,
      ),
    };
  });
  return toCharacterLibraryState(store);
}

// 查询工具（其他模块也可能用到）
export function findCharacter(
  store: { characters: CharacterSummary[] },
  characterId: string,
): CharacterSummary {
  const character = store.characters.find(item => item.id === characterId);
  if (!character) {
    throw new Error('未找到这个角色');
  }
  return character;
}

export function normalizeCharacterName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('请输入角色名称');
  }
  const name = value.trim();
  if (name.length > MAX_NAME_LENGTH) {
    throw new Error('角色名称最多 100 个字符');
  }
  return name;
}
