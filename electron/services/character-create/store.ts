// 角色视觉候选工作区的 JSON 持久化
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import { readJsonFile, writeJsonFile } from '../../storage/json-store';
import { getWorkspaceDirectory } from '../workspace';
import { STORE_FILE_NAME } from './constants';
import { parseGeneration } from './parsers';
import type { StoredGeneration, StoredGenerationStore } from './types';

const STORE_VERSION = 1;

function getStorePath(workspacePath: string): string {
  return path.join(workspacePath, STORE_FILE_NAME);
}

export async function loadStore(): Promise<StoredGenerationStore> {
  const value = await readJsonFile(getStorePath(await getWorkspaceDirectory()));
  if (!isPlainObject(value) || !Array.isArray(value.generations)) {
    return { generations: [], version: STORE_VERSION };
  }
  return {
    generations: (value.generations as unknown[])
      .map(parseGeneration)
      .filter((generation): generation is StoredGeneration => Boolean(generation)),
    version: STORE_VERSION,
  };
}

export async function saveStore(store: StoredGenerationStore): Promise<void> {
  await writeJsonFile(getStorePath(await getWorkspaceDirectory()), store);
}

export function replaceGeneration(
  store: StoredGenerationStore,
  generation: StoredGeneration,
): StoredGenerationStore {
  return {
    ...store,
    generations: [generation, ...store.generations.filter(item => item.id !== generation.id)],
  };
}

export function removeGeneration(
  store: StoredGenerationStore,
  generationId: string,
): StoredGenerationStore {
  return {
    ...store,
    generations: store.generations.filter(item => item.id !== generationId),
  };
}
