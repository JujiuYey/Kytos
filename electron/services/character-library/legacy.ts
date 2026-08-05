// character-library 历史遗留文件迁移：旧 character-draft / ip.md 等的初次读取与文件夹 copy
import { constants, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import { isNodeError, readJsonFile, writeJsonFile } from '../../storage/json-store';
import { MAX_NAME_LENGTH, STORE_FILE_NAME, LEGACY_CHARACTER_FILES } from './constants';
import { buildNewCharacter } from './store';
import type { StoredCharacterLibrary } from './types';

function getCharacterDraftPath(workspacePath: string, characterId: string): string {
  return path.join(workspacePath, 'characters', characterId, 'character-draft.json');
}

async function getLegacyCharacterName(workspacePath: string): Promise<string> {
  const value = await readJsonFile(path.join(workspacePath, 'character-draft.json'));
  return isPlainObject(value) && typeof value.name === 'string' && value.name.trim()
    ? value.name.trim().slice(0, MAX_NAME_LENGTH)
    : '主角色';
}

async function copyLegacyCharacterFiles(workspacePath: string, characterId: string): Promise<void> {
  const targetDirectory = path.join(workspacePath, 'characters', characterId);
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

export async function createInitialStore(workspacePath: string): Promise<StoredCharacterLibrary> {
  const character = buildNewCharacter(await getLegacyCharacterName(workspacePath));
  const store: StoredCharacterLibrary = {
    activeCharacterId: character.id,
    characters: [character],
    version: 2,
  };
  await copyLegacyCharacterFiles(workspacePath, character.id);
  await initializeCharacterDraft(workspacePath, character.id, character.name);
  await writeJsonFile(path.join(workspacePath, STORE_FILE_NAME), store);
  return store;
}

export async function updateCharacterDraftName(
  workspacePath: string,
  characterId: string,
  name: string,
): Promise<void> {
  const draftPath = getCharacterDraftPath(workspacePath, characterId);
  const value = await readJsonFile(draftPath);
  await writeJsonFile(draftPath, {
    ...(isPlainObject(value) ? value : {}),
    name,
  });
}
