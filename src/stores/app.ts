import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { AppSettings } from '@/types';

const defaultSettings: AppSettings = {
  autoSave: true,
  theme: 'system',
  storagePath: '',
  deepseekModel: 'deepseek-chat',
};

export const useAppStore = defineStore('app', () => {
  // 状态 (state)
  const settings = ref<AppSettings>(defaultSettings);

  const updateSettings = (partialSettings: Partial<AppSettings>) => {
    settings.value = { ...settings.value, ...partialSettings };
  };

  const resetSettings = () => {
    settings.value = defaultSettings;
  };

  return {
    // 状态
    settings,
    updateSettings,
    resetSettings,
  };
}, {
  persist: {
    key: 'app-setting',
    storage: localStorage,
    pick: ['settings'],
  },
});
