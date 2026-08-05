// character-library JSON 持久化与变更串行化
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { CharacterSummary } from '../../../shared/character-library';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { getWorkspaceDirectory } from '../workspace';
import { createInitialStore } from './legacy';
import { STORE_FILE_NAME, STORE_VERSION } from './constants';
import { parseStore } from './parsers';
import type { StoredCharacterLibrary } from './types';

let initialization: Promise<StoredCharacterLibrary> | null = null;
let initializedWorkspacePath = '';
let mutationQueue: Promise<void> = Promise.resolve();

function getStorePath(workspacePath: string): string {
  return path.join(workspacePath, STORE_FILE_NAME);
}

export function createCharacterId(): string {
  return `character_${randomUUID()}`;
}

export async function loadStore(): Promise<StoredCharacterLibrary> {
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
      const raw = value as Record<string, unknown> | null;
      if (!raw || raw.version !== STORE_VERSION || !Array.isArray(raw.characters)) {
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

export async function saveStore(store: StoredCharacterLibrary): Promise<void> {
  const workspacePath = await getWorkspaceDirectory();
  await writeJsonFile(getStorePath(workspacePath), store);
  initializedWorkspacePath = workspacePath;
  initialization = Promise.resolve(store);
}

// 串行执行 callback，对 store 做不可变更新 + 持久化；返回更新后的 store
export async function mutateStore(
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

export function buildNewCharacter(name: string): CharacterSummary {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    id: createCharacterId(),
    name,
    updatedAt: now,
  };
}
