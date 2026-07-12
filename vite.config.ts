import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import checkerPlugin from 'vite-plugin-checker';
import AutoImport from 'unplugin-auto-import/vite';
import Component from 'unplugin-vue-components/vite';
// import { VueRouterAutoImports } from 'unplugin-vue-router';
// import VueRouter from 'unplugin-vue-router/vite';
// import Layouts from 'vite-plugin-vue-layouts';

// const RouteGenerateExclude = ['**/components/**', '**/layouts/**', '**/data/**', '**/types/**'];

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
    // Layouts({
    //   defaultLayout: 'default',
    // }),
    // VueRouter({
    //   exclude: RouteGenerateExclude,
    //   dts: 'src/types/typed-router.d.ts',
    // }),
    AutoImport({
      include: [
        /\.[tj]sx?$/,
        /\.vue$/,
        /\.md$/,
      ],
      imports: [
        'vue',
        // VueRouterAutoImports,
      ],
      dirs: [
        'src/composables/**/*.ts',
        'src/enum/**/*.ts',
        'src/store/**/*.ts',
      ],
      defaultExportByFilename: true,
      dts: 'src/types/auto-import.d.ts',
    }),
    Component({
      dirs: [
        'src/components/ui',
      ],
      collapseSamePrefixes: true,
      directoryAsNamespace: false,
      dts: 'src/types/auto-import-components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
