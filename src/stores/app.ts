import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { AppSettings, DesktopSettings } from '@/types';
import { DEFAULT_DEEPSEEK_MODEL, isDeepSeekModel } from '@/types';

const defaultSettings: AppSettings = {
  theme: 'system',
  deepseekModel: DEFAULT_DEEPSEEK_MODEL,
};

export const useAppStore = defineStore(
  'app',
  () => {
    const settings = ref<AppSettings>(defaultSettings);
    const desktopSettings = ref<DesktopSettings | null>(null);
    const initializationError = ref('');
    const isInitializing = ref(false);
    const isInitialized = ref(false);

    const workspacePath = computed(() => desktopSettings.value?.workspacePath ?? null);
    const suggestedWorkspacePath = computed(
      () => desktopSettings.value?.suggestedWorkspacePath ?? '',
    );
    const isWorkspaceConfigured = computed(() => Boolean(workspacePath.value));

    const updateSettings = (partialSettings: Partial<AppSettings>) => {
      settings.value = { ...settings.value, ...partialSettings };
    };

    const resetSettings = () => {
      settings.value = defaultSettings;
    };

    const initializeDesktop = async () => {
      if (isInitialized.value || isInitializing.value) {
        return;
      }

      isInitializing.value = true;
      initializationError.value = '';
      try {
        desktopSettings.value = await window.desktop.getSettings();

        settings.value = {
          deepseekModel: isDeepSeekModel(settings.value.deepseekModel)
            ? settings.value.deepseekModel
            : DEFAULT_DEEPSEEK_MODEL,
          theme: settings.value.theme ?? defaultSettings.theme,
        };
      } catch (error: unknown) {
        initializationError.value = error instanceof Error ? error.message : String(error);
      } finally {
        isInitialized.value = true;
        isInitializing.value = false;
      }
    };

    const setWorkspaceDirectory = async (workspaceDirectory: string) => {
      desktopSettings.value = await window.desktop.setWorkspaceDirectory(workspaceDirectory);
    };

    const useSuggestedWorkspace = async () => {
      desktopSettings.value = await window.desktop.useSuggestedWorkspace();
    };

    const openWorkspaceDirectory = async () => {
      await window.desktop.openWorkspaceDirectory();
    };

    return {
      desktopSettings,
      initializationError,
      initializeDesktop,
      isInitialized,
      isInitializing,
      isWorkspaceConfigured,
      openWorkspaceDirectory,
      settings,
      setWorkspaceDirectory,
      suggestedWorkspacePath,
      useSuggestedWorkspace,
      workspacePath,
      updateSettings,
      resetSettings,
    };
  },
  {
    persist: {
      key: 'app-setting',
      storage: localStorage,
      pick: ['settings'],
    },
  },
);
