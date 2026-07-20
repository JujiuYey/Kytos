import type { UIMessage } from 'ai';

export const CHARACTER_AGENT_ENDPOINT = 'app://bundle/api/character-agent';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';

export const CHARACTER_SEED_FIELDS = ['name', 'characterSeed'] as const;

export const CHARACTER_VISUAL_ANCHOR_FIELDS = [
  'visualSummary',
  'ageAndBuild',
  'faceAnchor',
  'hairAnchor',
  'defaultOutfit',
  'characterPalette',
  'signatureItems',
  'silhouetteMarkers',
] as const;

export const CHARACTER_VISUAL_PRESENTATION_FIELDS = [
  'visualMedium',
  'lineAndShape',
  'colorRules',
  'detailDensity',
  'backgroundRules',
  'textRules',
  'exclusions',
] as const;

export const CHARACTER_DRAFT_FIELDS = [
  ...CHARACTER_SEED_FIELDS,
  ...CHARACTER_VISUAL_ANCHOR_FIELDS,
  ...CHARACTER_VISUAL_PRESENTATION_FIELDS,
] as const;

export type CharacterDraftField = (typeof CHARACTER_DRAFT_FIELDS)[number];

export type CharacterDraft = Record<CharacterDraftField, string>;

export const CHARACTER_CORE_FIELDS = [
  'name',
  'characterSeed',
  'visualSummary',
  'ageAndBuild',
  'faceAnchor',
  'hairAnchor',
  'defaultOutfit',
  'visualMedium',
  'colorRules',
  'backgroundRules',
] as const satisfies readonly CharacterDraftField[];

export type CharacterDraftPatch = Partial<CharacterDraft>;

export interface CharacterDraftUpdateResult {
  completion: number;
  draft: CharacterDraft;
  missingFields: CharacterDraftField[];
  updatedFields: CharacterDraftField[];
}

export interface CharacterWorkspaceState {
  draft: CharacterDraft;
}

type CharacterAgentTools = {
  updateCharacterDraft: {
    input: CharacterDraftPatch;
    output: CharacterDraftUpdateResult;
  };
};

export type CharacterAgentMessage = UIMessage<unknown, never, CharacterAgentTools>;

export function createEmptyCharacterDraft(): CharacterDraft {
  return Object.fromEntries(CHARACTER_DRAFT_FIELDS.map(field => [field, ''])) as CharacterDraft;
}

export function normalizeCharacterDraft(value: unknown): CharacterDraft {
  const draft = createEmptyCharacterDraft();
  if (!value || typeof value !== 'object') {
    return draft;
  }

  const record = value as Record<string, unknown>;
  for (const field of CHARACTER_DRAFT_FIELDS) {
    if (typeof record[field] === 'string') {
      draft[field] = record[field].trim();
    }
  }

  const legacyMappings: Array<[CharacterDraftField, string]> = [
    ['name', 'name'],
    ['characterSeed', 'rolePositioning'],
    ['characterSeed', 'concept'],
    ['exclusions', 'forbiddenElements'],
  ];
  for (const [field, legacyField] of legacyMappings) {
    if (!draft[field] && typeof record[legacyField] === 'string') {
      draft[field] = record[legacyField].trim();
    }
  }
  return draft;
}

export function getCharacterDraftProgress(draft: CharacterDraft): {
  completion: number;
  missingFields: CharacterDraftField[];
} {
  const missingFields = CHARACTER_CORE_FIELDS.filter(field => !draft[field].trim());
  const completedFields = CHARACTER_CORE_FIELDS.length - missingFields.length;

  return {
    completion: Math.round((completedFields / CHARACTER_CORE_FIELDS.length) * 100),
    missingFields,
  };
}
