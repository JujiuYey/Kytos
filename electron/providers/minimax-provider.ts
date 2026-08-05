// minimax 兼容模式 provider（OpenAI-compatible）
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const MINIMAX_API_BASE_URL = 'https://api.minimaxi.com/v1';

export function createMinimaxCompatibleProvider(apiKey: string) {
  return createOpenAICompatible({
    apiKey,
    baseURL: MINIMAX_API_BASE_URL,
    name: 'minimax',
  });
}
