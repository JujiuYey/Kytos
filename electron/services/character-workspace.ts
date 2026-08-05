import path from 'node:path';
import type { CharacterDraft, CharacterWorkspaceState } from '../../shared/character';
import { normalizeCharacterDraft } from '../../shared/character';
import { getActiveCharacterDirectory } from './character-library';
import { readJsonFile } from '../storage/json-store';

const DRAFT_FILE_NAME = 'character-draft.json';

function parseCharacterDraft(value: unknown): CharacterDraft {
  return normalizeCharacterDraft(value);
}

export async function loadCharacterDraft(): Promise<CharacterDraft> {
  const characterPath = await getActiveCharacterDirectory();
  const value = await readJsonFile(path.join(characterPath, DRAFT_FILE_NAME));
  return parseCharacterDraft(value);
}

export async function getCharacterWorkspace(): Promise<CharacterWorkspaceState> {
  return { draft: await loadCharacterDraft() };
}
