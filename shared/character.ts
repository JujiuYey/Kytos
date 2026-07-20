import type { UIMessage } from 'ai';

export const CHARACTER_AGENT_ENDPOINT = 'app://bundle/api/character-agent';
export const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-pro';

export const CHARACTER_ROLE_CORE_FIELDS = [
  'name',
  'rolePositioning',
  'behavioralContradiction',
  'dailyContext',
  'narrativeNotes',
] as const;

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
] as const;

export const CHARACTER_CONSISTENCY_FIELDS = [
  'mustKeep',
  'allowedChanges',
  'forbiddenElements',
  'referenceImageNotes',
] as const;

export const CHARACTER_DRAFT_FIELDS = [
  ...CHARACTER_ROLE_CORE_FIELDS,
  ...CHARACTER_VISUAL_ANCHOR_FIELDS,
  ...CHARACTER_VISUAL_PRESENTATION_FIELDS,
  ...CHARACTER_CONSISTENCY_FIELDS,
] as const;

export type CharacterDraftField = (typeof CHARACTER_DRAFT_FIELDS)[number];

export type CharacterDraft = Record<CharacterDraftField, string>;

export const CHARACTER_CORE_FIELDS = [
  'name',
  'rolePositioning',
  'visualSummary',
  'ageAndBuild',
  'faceAnchor',
  'hairAnchor',
  'defaultOutfit',
  'visualMedium',
  'colorRules',
  'backgroundRules',
  'mustKeep',
  'allowedChanges',
  'forbiddenElements',
] as const satisfies readonly CharacterDraftField[];

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
    ['rolePositioning', 'concept'],
    ['behavioralContradiction', 'personality'],
    ['dailyContext', 'background'],
  ];
  for (const [field, legacyField] of legacyMappings) {
    if (!draft[field] && typeof record[legacyField] === 'string') {
      draft[field] = record[legacyField].trim();
    }
  }

  if (!draft.narrativeNotes) {
    const legacyNotes = [
      ['动机', record.motivation],
      ['关系', record.relationships],
      ['说话方式', record.speechStyle],
    ]
      .filter(
        (entry): entry is [string, string] =>
          typeof entry[1] === 'string' && Boolean(entry[1].trim()),
      )
      .map(([label, content]) => `${label}：${content.trim()}`);
    draft.narrativeNotes = legacyNotes.join('\n');
  }

  return draft;
}

export function isCharacterDraftReady(draft: CharacterDraft): boolean {
  return CHARACTER_CORE_FIELDS.every(field => draft[field].trim());
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
