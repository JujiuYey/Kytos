import { randomUUID } from 'node:crypto';
import { constants, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterLibraryState,
  CharacterSummary,
  CreateCharacterRequest,
  DeleteCharacterRequest,
  SelectCharacterRequest,
  UpdateCharacterRequest,
} from '../../shared/character-library';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const STORE_FILE_NAME = 'character-library.json';
const CHARACTER_DIRECTORY = 'characters';
const LEGACY_CHARACTER_FILES = [
  'character-draft.json',
  'character-expressions.json',
  'character-portraits.json',
  'ip.md',
] as const;
const MAX_NAME_LENGTH = 100;
const ID_PATTERN = /^character_[A-Za-z0-9-]{1,200}$/;

interface StoredCharacterLibrary extends CharacterLibraryState {
  version: 2;
}

let initialization: Promise<StoredCharacterLibrary> | null = null;
let initializedWorkspacePath = '';
let mutationQueue: Promise<void> = Promise.resolve();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function createCharacterId(): string {
  return `character_${randomUUID()}`;
}

function validateName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > MAX_NAME_LENGTH) {
    throw new Error('角色名称无效');
  }
  return value.trim();
}

function parseCharacter(value: unknown): CharacterSummary | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !ID_PATTERN.test(value.id) ||
    typeof value.name !== 'string' ||
    !value.name.trim() ||
    value.name.length > MAX_NAME_LENGTH
  ) {
    return null;
  }
  const now = new Date().toISOString();
  return {
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : now,
    id: value.id,
    name: value.name.trim(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : now,
  };
}

function parseCharacters(value: unknown): CharacterSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(parseCharacter)
    .filter((character): character is CharacterSummary => Boolean(character));
}

function parseStore(value: unknown): StoredCharacterLibrary | null {
  if (!isRecord(value)) {
    return null;
  }

  let characters = parseCharacters(value.characters);
  if (!characters.length && Array.isArray(value.ips)) {
    characters = value.ips.flatMap(ip => (isRecord(ip) ? parseCharacters(ip.characters) : []));
  }
  if (!characters.length) {
    return null;
  }

  const activeCharacterId =
    typeof value.activeCharacterId === 'string' &&
    characters.some(character => character.id === value.activeCharacterId)
      ? value.activeCharacterId
      : characters[0].id;
  return { activeCharacterId, characters, version: 2 };
}

function getStorePath(workspacePath: string): string {
  return path.join(workspacePath, STORE_FILE_NAME);
}

async function getLegacyCharacterName(workspacePath: string): Promise<string> {
  const value = await readJsonFile(path.join(workspacePath, 'character-draft.json'));
  return isRecord(value) && typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().slice(0, MAX_NAME_LENGTH)
    : '主角色';
}

async function copyLegacyCharacterFiles(workspacePath: string, characterId: string): Promise<void> {
  const targetDirectory = path.join(workspacePath, CHARACTER_DIRECTORY, characterId);
  await mkdir(targetDirectory, { recursive: true });
  await Promise.all(
    LEGACY_CHARACTER_FILES.map(async fileName => {
      try {
        await copyFile(
          path.join(workspacePath, fileName),
          path.join(targetDirectory, fileName),
          constants.COPYFILE_EXCL,
        );
      } catch (error: unknown) {
        if (!isNodeError(error) || !['ENOENT', 'EEXIST'].includes(error.code ?? '')) {
          throw error;
        }
      }
    }),
  );
}

function getCharacterDraftPath(workspacePath: string, characterId: string): string {
  return path.join(workspacePath, CHARACTER_DIRECTORY, characterId, 'character-draft.json');
}

async function initializeCharacterDraft(
  workspacePath: string,
  characterId: string,
  name: string,
): Promise<void> {
  const draftPath = getCharacterDraftPath(workspacePath, characterId);
  if ((await readJsonFile(draftPath)) === null) {
    await writeJsonFile(draftPath, { name });
  }
}

async function updateCharacterDraftName(
  workspacePath: string,
  characterId: string,
  name: string,
): Promise<void> {
  const draftPath = getCharacterDraftPath(workspacePath, characterId);
  const value = await readJsonFile(draftPath);
  await writeJsonFile(draftPath, { ...(isRecord(value) ? value : {}), name });
}

async function createInitialStore(workspacePath: string): Promise<StoredCharacterLibrary> {
  const now = new Date().toISOString();
  const character: CharacterSummary = {
    createdAt: now,
    id: createCharacterId(),
    name: await getLegacyCharacterName(workspacePath),
    updatedAt: now,
  };
  const store: StoredCharacterLibrary = {
    activeCharacterId: character.id,
    characters: [character],
    version: 2,
  };
  await copyLegacyCharacterFiles(workspacePath, character.id);
  await initializeCharacterDraft(workspacePath, character.id, character.name);
  await writeJsonFile(getStorePath(workspacePath), store);
  return store;
}

async function loadStore(): Promise<StoredCharacterLibrary> {
  const workspacePath = await getWorkspaceDirectory();
  if (initializedWorkspacePath !== workspacePath) {
    initialization = null;
    initializedWorkspacePath = workspacePath;
  }
  if (!initialization) {
    initialization = (async () => {
      const value = await readJsonFile(getStorePath(workspacePath));
      const store = parseStore(value);
      if (!store) {
        return createInitialStore(workspacePath);
      }
      if (!isRecord(value) || value.version !== 2 || !Array.isArray(value.characters)) {
        await writeJsonFile(getStorePath(workspacePath), store);
      }
      return store;
    })().catch(error => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function saveStore(store: StoredCharacterLibrary): Promise<void> {
  const workspacePath = await getWorkspaceDirectory();
  await writeJsonFile(getStorePath(workspacePath), store);
  initializedWorkspacePath = workspacePath;
  initialization = Promise.resolve(store);
}

async function mutateStore(
  mutation: (
    store: StoredCharacterLibrary,
  ) => Promise<StoredCharacterLibrary> | StoredCharacterLibrary,
): Promise<StoredCharacterLibrary> {
  let result: StoredCharacterLibrary | null = null;
  const operation = mutationQueue.then(async () => {
    result = await mutation(await loadStore());
    await saveStore(result);
  });
  mutationQueue = operation.then(
    () => undefined,
    () => undefined,
  );
  await operation;
  if (!result) {
    throw new Error('角色资料更新失败');
  }
  return result;
}

function findCharacter(store: StoredCharacterLibrary, characterId: string): CharacterSummary {
  const character = store.characters.find(item => item.id === characterId);
  if (!character) {
    throw new Error('未找到这个角色');
  }
  return character;
}

export async function getCharacterLibrary(): Promise<CharacterLibraryState> {
  const { version: _version, ...state } = await loadStore();
  return state;
}

export async function getActiveCharacterDirectory(): Promise<string> {
  const store = await loadStore();
  return path.join(await getWorkspaceDirectory(), CHARACTER_DIRECTORY, store.activeCharacterId);
}

export async function createCharacter(
  request: CreateCharacterRequest,
): Promise<CharacterLibraryState> {
  const name = validateName(request?.name);
  return mutateStore(async store => {
    const now = new Date().toISOString();
    const character: CharacterSummary = {
      createdAt: now,
      id: createCharacterId(),
      name,
      updatedAt: now,
    };
    await initializeCharacterDraft(await getWorkspaceDirectory(), character.id, character.name);
    return {
      ...store,
      activeCharacterId: character.id,
      characters: [character, ...store.characters],
    };
  });
}

export async function updateCharacter(
  request: UpdateCharacterRequest,
): Promise<CharacterLibraryState> {
  const name = validateName(request?.name);
  return mutateStore(async store => {
    const character = findCharacter(store, request.characterId);
    const now = new Date().toISOString();
    await updateCharacterDraftName(await getWorkspaceDirectory(), character.id, name);
    return {
      ...store,
      characters: store.characters.map(item =>
        item.id === character.id ? { ...item, name, updatedAt: now } : item,
      ),
    };
  });
}

export async function updateActiveCharacterName(name: string): Promise<void> {
  if (!name.trim()) {
    return;
  }
  await mutateStore(store => {
    const character = findCharacter(store, store.activeCharacterId);
    const normalizedName = name.trim().slice(0, MAX_NAME_LENGTH);
    if (character.name === normalizedName) {
      return store;
    }
    const now = new Date().toISOString();
    return {
      ...store,
      characters: store.characters.map(item =>
        item.id === character.id ? { ...item, name: normalizedName, updatedAt: now } : item,
      ),
    };
  });
}

export async function deleteCharacter(
  request: DeleteCharacterRequest,
): Promise<CharacterLibraryState> {
  return mutateStore(store => {
    findCharacter(store, request?.characterId);
    if (store.characters.length === 1) {
      throw new Error('至少保留一个角色');
    }
    const characters = store.characters.filter(character => character.id !== request.characterId);
    const activeCharacterId =
      store.activeCharacterId === request.characterId ? characters[0].id : store.activeCharacterId;
    return { ...store, activeCharacterId, characters };
  });
}

export async function selectCharacter(
  request: SelectCharacterRequest,
): Promise<CharacterLibraryState> {
  return mutateStore(store => {
    const character = findCharacter(store, request?.characterId);
    return { ...store, activeCharacterId: character.id };
  });
}
