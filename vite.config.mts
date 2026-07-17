import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import checkerPlugin from 'vite-plugin-checker';

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss(),
    checkerPlugin({
      eslint: {
        lintCommand: 'eslint "./src/**/*.{ts,tsx,vue}"',
        useFlatConfig: true,
      },
      enableBuild: false,
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
