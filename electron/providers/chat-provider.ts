// 聊天模型 provider 编排：按模型选择对应厂商实现
import {
  getChatModelDefinition,
  type ChatModel,
  type ChatModelProvider,
} from '../../shared/chat-model';
import { createDeepSeekCompatibleProvider, DEEPSEEK_PROVIDER_OPTIONS } from './deepseek-provider';
import { createMinimaxCompatibleProvider } from './minimax-provider';

export function getChatModelProvider(model: ChatModel): ChatModelProvider {
  return getChatModelDefinition(model).provider;
}

export function createChatLanguageModel(apiKey: string, model: ChatModel) {
  if (getChatModelProvider(model) === 'minimax') {
    return createMinimaxCompatibleProvider(apiKey)(model);
  }
  return createDeepSeekCompatibleProvider(apiKey)(model);
}

export function getChatProviderOptions(model: ChatModel) {
  return getChatModelProvider(model) === 'deepseek' ? DEEPSEEK_PROVIDER_OPTIONS : undefined;
}
