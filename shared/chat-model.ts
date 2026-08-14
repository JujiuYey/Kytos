// 聊天模型厂商、模型与能力定义
export const DEEPSEEK_MODELS = ['deepseek-v4-flash', 'deepseek-v4-pro'] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];

export const DEFAULT_DEEPSEEK_MODEL: DeepSeekModel = 'deepseek-v4-pro';

export const MINIMAX_MODELS = ['MiniMax-M3'] as const;
export type MiniMaxModel = (typeof MINIMAX_MODELS)[number];

export const DEFAULT_MINIMAX_MODEL: MiniMaxModel = 'MiniMax-M3';

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

export const DEFAULT_CHAT_MODEL: ChatModel = DEFAULT_MINIMAX_MODEL;

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
