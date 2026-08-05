// 角色模块的模型、草稿与字段定义
export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
// DeepSeek 模型类型
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

// 默认 DeepSeek 模型
export const DEFAULT_DEEPSEEK_MODEL: DeepSeekModel = 'deepseek-v4-pro';

export const MINIMAX_MODELS = ['MiniMax-M3'] as const;
export type MiniMaxModel = (typeof MINIMAX_MODELS)[number];

export const CHAT_MODELS = [...DEEPSEEK_MODELS, ...MINIMAX_MODELS] as const;
export type ChatModel = (typeof CHAT_MODELS)[number];
export type ChatModelProvider = 'deepseek' | 'minimax';

export interface ChatModelDefinition {
  id: ChatModel;
  label: string;
  provider: ChatModelProvider;
  supportsImageInput: boolean;
}

export const CHAT_MODEL_DEFINITIONS: Record<ChatModel, ChatModelDefinition> = {
  'deepseek-v4-flash': {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4 Flash',
    provider: 'deepseek',
    supportsImageInput: false,
  },
  'deepseek-v4-pro': {
    id: 'deepseek-v4-pro',
    label: 'DeepSeek V4 Pro',
    provider: 'deepseek',
    supportsImageInput: false,
  },
  'MiniMax-M3': {
    id: 'MiniMax-M3',
    label: 'MiniMax M3',
    provider: 'minimax',
    supportsImageInput: true,
  },
};

export const DEFAULT_CHAT_MODEL: ChatModel = DEFAULT_DEEPSEEK_MODEL;

export const IMAGE_MODELS = ['gpt-image-2'] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];
export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-2';

// 判断值是否为合法的 DeepSeek 模型
export function isDeepSeekModel(value: unknown): value is DeepSeekModel {
  return typeof value === 'string' && DEEPSEEK_MODELS.includes(value as DeepSeekModel);
}

export function isChatModel(value: unknown): value is ChatModel {
  return typeof value === 'string' && CHAT_MODELS.includes(value as ChatModel);
}

export function getChatModelDefinition(model: ChatModel): ChatModelDefinition {
  return CHAT_MODEL_DEFINITIONS[model];
}

export function chatModelSupportsImageInput(model: ChatModel): boolean {
  return getChatModelDefinition(model).supportsImageInput;
}

export function isImageModel(value: unknown): value is ImageModel {
  return typeof value === 'string' && IMAGE_MODELS.includes(value as ImageModel);
}

// 角色种子字段（名称、定位）
export const CHARACTER_SEED_FIELDS = ['name', 'characterSeed'] as const;

// 角色视觉锚点字段
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

// 角色视觉呈现字段
export const CHARACTER_VISUAL_PRESENTATION_FIELDS = [
  'visualMedium',
  'lineAndShape',
  'colorRules',
  'detailDensity',
  'backgroundRules',
  'textRules',
  'exclusions',
] as const;

// 角色草稿全部字段（种子 + 视觉锚点 + 视觉呈现）
export const CHARACTER_DRAFT_FIELDS = [
  ...CHARACTER_SEED_FIELDS,
  ...CHARACTER_VISUAL_ANCHOR_FIELDS,
  ...CHARACTER_VISUAL_PRESENTATION_FIELDS,
] as const;

// 角色草稿字段名联合类型
export type CharacterDraftField = (typeof CHARACTER_DRAFT_FIELDS)[number];

// 角色草稿
export type CharacterDraft = Record<CharacterDraftField, string>;

// 角色工作区状态
export interface CharacterWorkspaceState {
  // 当前草稿
  draft: CharacterDraft;
}

// 创建空角色草稿
export function createEmptyCharacterDraft(): CharacterDraft {
  return Object.fromEntries(CHARACTER_DRAFT_FIELDS.map(field => [field, ''])) as CharacterDraft;
}

// 规范化角色草稿：补全缺失字段并兼容历史字段名
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
