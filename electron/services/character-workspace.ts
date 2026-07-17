import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CharacterDraft,
  CharacterWorkspaceState,
  SaveCharacterProfileRequest,
} from '../../shared/character';
import { CHARACTER_DRAFT_FIELDS, createEmptyCharacterDraft } from '../../shared/character';
import { isNodeError, readJsonFile, writeJsonFile, writeTextFile } from './json-store';
import { getWorkspaceDirectory } from './workspace';

const DRAFT_FILE_NAME = 'character-draft.json';
const PROFILE_FILE_NAME = 'ip.md';

function parseCharacterDraft(value: unknown): CharacterDraft {
  const draft = createEmptyCharacterDraft();
  if (!value || typeof value !== 'object') {
    return draft;
  }

  const record = value as Record<string, unknown>;
  for (const field of CHARACTER_DRAFT_FIELDS) {
    const fieldValue = record[field];
    if (typeof fieldValue === 'string') {
      draft[field] = fieldValue;
    }
  }
  return draft;
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
  const workspacePath = await getWorkspaceDirectory();
  const value = await readJsonFile(path.join(workspacePath, DRAFT_FILE_NAME));
  return parseCharacterDraft(value);
}

export async function saveCharacterDraft(draft: CharacterDraft): Promise<void> {
  const workspacePath = await getWorkspaceDirectory();
  await writeJsonFile(path.join(workspacePath, DRAFT_FILE_NAME), draft);
}

export async function getCharacterWorkspace(): Promise<CharacterWorkspaceState> {
  const workspacePath = await getWorkspaceDirectory();
  const [draft, profileMarkdown] = await Promise.all([
    loadCharacterDraft(),
    readOptionalTextFile(path.join(workspacePath, PROFILE_FILE_NAME)),
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

  const workspacePath = await getWorkspaceDirectory();
  await writeTextFile(path.join(workspacePath, PROFILE_FILE_NAME), `${markdown}\n`);
}
