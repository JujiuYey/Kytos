import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterDraft,
  CharacterWorkspaceState,
  SaveCharacterProfileRequest,
} from '../../shared/character';
import { normalizeCharacterDraft } from '../../shared/character';
import { getActiveCharacterDirectory, updateActiveCharacterName } from './character-library';
import { isNodeError, readJsonFile, writeJsonFile, writeTextFile } from './json-store';

const DRAFT_FILE_NAME = 'character-draft.json';
const PROFILE_FILE_NAME = 'ip.md';

function parseCharacterDraft(value: unknown): CharacterDraft {
  return normalizeCharacterDraft(value);
}

async function readOptionalTextFile(filePath: string): Promise<string | null> {
  try {
    return await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function loadCharacterDraft(): Promise<CharacterDraft> {
  const characterPath = await getActiveCharacterDirectory();
  const value = await readJsonFile(path.join(characterPath, DRAFT_FILE_NAME));
  return parseCharacterDraft(value);
}

export async function saveCharacterDraft(draft: CharacterDraft): Promise<void> {
  const characterPath = await getActiveCharacterDirectory();
  await writeJsonFile(path.join(characterPath, DRAFT_FILE_NAME), draft);
  await updateActiveCharacterName(draft.name);
}

export async function getCharacterWorkspace(): Promise<CharacterWorkspaceState> {
  const characterPath = await getActiveCharacterDirectory();
  const [draft, profileMarkdown] = await Promise.all([
    loadCharacterDraft(),
    readOptionalTextFile(path.join(characterPath, PROFILE_FILE_NAME)),
  ]);
  return { draft, profileMarkdown };
}

export async function saveCharacterProfile(request: SaveCharacterProfileRequest): Promise<void> {
  if (!request || typeof request !== 'object' || typeof request.markdown !== 'string') {
    throw new Error('角色档案内容无效');
  }

  const markdown = request.markdown.trim();
  if (!markdown || markdown.length > 100_000) {
    throw new Error('角色档案内容无效');
  }

  const characterPath = await getActiveCharacterDirectory();
  await writeTextFile(path.join(characterPath, PROFILE_FILE_NAME), `${markdown}\n`);
}
