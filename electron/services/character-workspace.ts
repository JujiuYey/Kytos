import path from 'node:path';
import type { CharacterDraft, CharacterWorkspaceState } from '../../shared/character';
import { normalizeCharacterDraft } from '../../shared/character';
import { getActiveCharacterDirectory, updateActiveCharacterName } from './character-library';
import { readJsonFile, writeJsonFile } from './json-store';

const DRAFT_FILE_NAME = 'character-draft.json';

function parseCharacterDraft(value: unknown): CharacterDraft {
  return normalizeCharacterDraft(value);
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
  return { draft: await loadCharacterDraft() };
}
