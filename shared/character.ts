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

export interface CharacterWorkspaceState {
  draft: CharacterDraft;
}

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
