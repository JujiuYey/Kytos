import { ref, computed } from 'vue';

type Theme = 'light' | 'dark' | 'system';

const theme = ref<Theme>('system');

export function useTheme() {
  const setTheme = (newTheme: Theme) => {
    theme.value = newTheme;
    // 实现主题切换逻辑
    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.classList.toggle('dark', systemTheme === 'dark');
    } else {
      document.documentElement.classList.toggle('dark', newTheme === 'dark');
    }
    localStorage.setItem('theme', newTheme);
  };

  return {
    theme: computed(() => theme.value),
    setTheme,
  };
}
