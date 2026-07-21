import { computed } from 'vue';
import { useAppStore } from '@/stores/app';
import type { AppSettings } from '@/types';

type Theme = AppSettings['theme'];

let systemThemeQuery: MediaQueryList | null = null;

function applyTheme(theme: Theme) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  document.documentElement.classList.toggle('dark', isDark);
  document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  void window.desktop.setTheme(theme);
}

export function useTheme() {
  const appStore = useAppStore();

  const setTheme = (newTheme: Theme) => {
    appStore.updateSettings({ theme: newTheme });
    applyTheme(newTheme);
  };

  const initializeTheme = () => {
    applyTheme(appStore.settings.theme);

    if (!systemThemeQuery) {
      systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      systemThemeQuery.addEventListener('change', () => {
        if (appStore.settings.theme === 'system') {
          applyTheme('system');
        }
      });
    }
  };

  return {
    initializeTheme,
    setTheme,
    theme: computed(() => appStore.settings.theme),
  };
}
