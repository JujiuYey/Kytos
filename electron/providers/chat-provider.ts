// 聊天模型 provider 编排：统一走 DeepSeek 兼容实现
import type { ChatModel } from '../../shared/chat-model';
import { createDeepSeekCompatibleProvider, DEEPSEEK_PROVIDER_OPTIONS } from './deepseek-provider';

export function createChatLanguageModel(apiKey: string, model: ChatModel) {
  return createDeepSeekCompatibleProvider(apiKey)(model);
}

export function getChatProviderOptions(_model: ChatModel) {
  return DEEPSEEK_PROVIDER_OPTIONS;
}
