import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import {
  getChatModelDefinition,
  type ChatModel,
  type ChatModelProvider,
} from '../../shared/character';
import { createDeepSeekCompatibleProvider, DEEPSEEK_PROVIDER_OPTIONS } from './deepseek-provider';

const MINIMAX_API_BASE_URL = 'https://api.minimaxi.com/v1';

function createMiniMaxCompatibleProvider(apiKey: string) {
  return createOpenAICompatible({
    apiKey,
    baseURL: MINIMAX_API_BASE_URL,
    name: 'minimax',
  });
}

export function getChatModelProvider(model: ChatModel): ChatModelProvider {
  return getChatModelDefinition(model).provider;
}

export function createChatLanguageModel(apiKey: string, model: ChatModel) {
  if (getChatModelProvider(model) === 'minimax') {
    return createMiniMaxCompatibleProvider(apiKey)(model);
  }
  return createDeepSeekCompatibleProvider(apiKey)(model);
}

export function getChatProviderOptions(model: ChatModel) {
  return getChatModelProvider(model) === 'deepseek' ? DEEPSEEK_PROVIDER_OPTIONS : undefined;
}
