import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const DEEPSEEK_API_BASE_URL = 'https://api.deepseek.com';

export function createDeepSeekCompatibleProvider(apiKey: string) {
  return createOpenAICompatible({
    apiKey,
    baseURL: DEEPSEEK_API_BASE_URL,
    name: 'deepseek',
  });
}

export const DEEPSEEK_PROVIDER_OPTIONS = {
  deepseek: {
    thinking: { type: 'disabled' },
  },
} as const;
