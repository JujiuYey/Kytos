import type { UIMessage } from 'ai';

export const CHARACTER_AGENT_ENDPOINT = 'app://bundle/api/character-agent';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

export const CHARACTER_DRAFT_FIELDS = [
  'name',
  'concept',
  'personality',
  'motivation',
  'background',
  'relationships',
  'speechStyle',
] as const;

export const CHARACTER_CORE_FIELDS = [
  'name',
  'concept',
  'personality',
  'motivation',
  'background',
] as const satisfies readonly CharacterDraftField[];

export type CharacterDraftField = (typeof CHARACTER_DRAFT_FIELDS)[number];

export interface CharacterDraft {
  background: string;
  concept: string;
  motivation: string;
  name: string;
  personality: string;
  relationships: string;
  speechStyle: string;
}

export type CharacterDraftPatch = Partial<CharacterDraft>;

export interface CharacterDraftUpdateResult {
  completion: number;
  draft: CharacterDraft;
  missingFields: CharacterDraftField[];
  updatedFields: CharacterDraftField[];
}

export interface CharacterProfileProposalResult {
  draft: CharacterDraft;
  markdown: string;
  ready: boolean;
  missingFields: CharacterDraftField[];
}

export interface CharacterWorkspaceState {
  draft: CharacterDraft;
  profileMarkdown: string | null;
}

export interface SaveCharacterProfileRequest {
  markdown: string;
}

type CharacterAgentTools = {
  completeCharacterProfile: {
    input: { markdown: string };
    output: CharacterProfileProposalResult;
  };
  updateCharacterDraft: {
    input: CharacterDraftPatch;
    output: CharacterDraftUpdateResult;
  };
};

export type CharacterAgentMessage = UIMessage<unknown, never, CharacterAgentTools>;

export function createEmptyCharacterDraft(): CharacterDraft {
  return {
    background: '',
    concept: '',
    motivation: '',
    name: '',
    personality: '',
    relationships: '',
    speechStyle: '',
  };
}

export function isCharacterDraftReady(draft: CharacterDraft): boolean {
  return CHARACTER_CORE_FIELDS.every(field => draft[field].trim());
}

export function getCharacterDraftProgress(draft: CharacterDraft): {
  completion: number;
  missingFields: CharacterDraftField[];
} {
  const missingFields = CHARACTER_DRAFT_FIELDS.filter(field => !draft[field].trim());
  const completedFields = CHARACTER_DRAFT_FIELDS.length - missingFields.length;

  return {
    completion: Math.round((completedFields / CHARACTER_DRAFT_FIELDS.length) * 100),
    missingFields,
  };
}
