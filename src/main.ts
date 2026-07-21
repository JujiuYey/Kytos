import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import router from './router';
import { useTheme } from '@/composables/use-theme';
import { useAppStore } from '@/stores/app';
import './index.css';

async function bootstrap() {
  const app = createApp(App);
  const pinia = createPinia();

  pinia.use(piniaPluginPersistedstate);
  app.use(pinia);

  await useAppStore(pinia).initializeDesktop();
  useTheme().initializeTheme();

  app.use(router).mount('#app');
}

void bootstrap();
