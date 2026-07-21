<script setup lang="ts">
import { computed } from 'vue';
import ProjectDir from './components/project-dir.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import DeepseekModel from './components/deepseek-model.vue';
import ThemeToggle from '@/components/theme/theme-toggle.vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/composables/use-theme';

const { theme } = useTheme();

const themeLabel = computed(() => {
  const labels = {
    dark: '深色',
    light: '浅色',
    system: '跟随系统',
  };

  return labels[theme.value];
});
</script>

<template>
  <main class="h-full min-h-0 overflow-hidden">
    <ScrollArea class="h-full">
      <div class="mx-auto w-full max-w-3xl px-6 py-8 lg:py-10">
        <header>
          <h1 class="text-2xl font-semibold">系统设置</h1>
          <p class="mt-1.5 text-sm text-muted-foreground">
            管理界面外观、本地作品目录和外部模型服务凭据。
          </p>
        </header>

        <section aria-labelledby="appearance-heading" class="mt-10">
          <div class="mb-4">
            <h2 id="appearance-heading" class="text-base font-semibold">外观</h2>
            <p class="mt-1 text-sm text-muted-foreground">选择应用使用的界面主题。</p>
          </div>
          <div class="flex items-center justify-between gap-4 rounded-md border p-5">
            <div class="min-w-0">
              <h3 class="text-sm font-medium">界面主题</h3>
              <p class="mt-1 text-sm text-muted-foreground">当前：{{ themeLabel }}</p>
            </div>
            <ThemeToggle />
          </div>
        </section>

        <Separator class="my-10" />

        <section aria-labelledby="workspace-heading">
          <div class="mb-4">
            <h2 id="workspace-heading" class="text-base font-semibold">作品工作区</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              素材和生成结果保存在这里。切换目录不会搬迁已有文件。
            </p>
          </div>
          <ProjectDir />
        </section>

        <Separator class="my-10" />

        <section aria-labelledby="credentials-heading">
          <div class="mb-4">
            <h2 id="credentials-heading" class="text-base font-semibold">模型与凭据</h2>
            <p class="mt-1 text-sm text-muted-foreground">
              API Key 使用系统凭据保护机制加密，只保存在这台设备的应用数据目录中。
            </p>
          </div>

          <div class="divide-y rounded-md border">
            <DeepseekKey />
            <DeepseekModel />
            <ApimartKey />
          </div>
        </section>
      </div>
    </ScrollArea>
  </main>
</template>
