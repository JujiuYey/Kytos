import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { OllamaServerConfig } from '@/types';

const defaultSettings: OllamaServerConfig = {
  ollamaUrl: 'http://localhost:11434',
  selectedModel: '',
  temperature: 0.7,
  maxTokens: 2048,
  systemPrompt: '你是一个有用的AI助手。',
};

export const useOllamaConfig = defineStore('ollama-config', () => {
  const configs = ref<OllamaServerConfig>(defaultSettings);

  const updateConfigs = (partialConfigs: Partial<OllamaServerConfig>) => {
    configs.value = { ...configs.value, ...partialConfigs };
  };

  const resetConfigs = () => {
    configs.value = defaultSettings;
  };

  return {
    configs,
    updateConfigs,
    resetConfigs,
  };
}, {
  persist: {
    key: 'ollama-config',
    storage: localStorage,
    pick: ['configs'],
  },
});
