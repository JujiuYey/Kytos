import type { CharacterDraft, CharacterWorkspaceState } from '../../shared/character';
import { loadCharacterDraft as readCharacterDraft, loadStore } from './character-library/store';

export async function loadCharacterDraft(): Promise<CharacterDraft> {
  const store = await loadStore();
  return readCharacterDraft(store.activeCharacterId);
}

export async function getCharacterWorkspace(): Promise<CharacterWorkspaceState> {
  return { draft: await loadCharacterDraft() };
}
