<script setup lang="ts">
import { computed } from 'vue';
import ProjectDir from './components/project-dir.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import MinimaxKey from './components/minimax-key.vue';
import ModelSettings from './components/model-settings.vue';
import ThemeToggle from '@/components/theme/theme-toggle.vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
      <div class="w-full px-6 py-8 lg:px-10 lg:py-10">
        <header>
          <h1 class="text-2xl font-semibold">系统设置</h1>
          <p class="mt-1.5 text-sm text-muted-foreground">
            管理界面外观、本地作品目录、默认模型和模型厂商。
          </p>
        </header>

        <Tabs default-value="basic" class="mt-8 w-full">
          <TabsList aria-label="设置分类">
            <TabsTrigger value="basic">基本配置</TabsTrigger>
            <TabsTrigger value="defaults">默认模型</TabsTrigger>
            <TabsTrigger value="providers">模型厂商</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" class="mt-4 space-y-8">
            <section aria-labelledby="appearance-heading">
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

            <section aria-labelledby="workspace-heading">
              <div class="mb-4">
                <h2 id="workspace-heading" class="text-base font-semibold">作品工作区</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  素材和生成结果保存在这里。切换目录不会搬迁已有文件。
                </p>
              </div>
              <ProjectDir />
            </section>
          </TabsContent>

          <TabsContent value="defaults" class="mt-4">
            <section aria-labelledby="models-heading">
              <div class="mb-4">
                <h2 id="models-heading" class="text-base font-semibold">默认模型</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  为不同任务选择默认模型。配置会保存在本机，不会上传模型凭据。
                </p>
              </div>
              <ModelSettings />
            </section>
          </TabsContent>

          <TabsContent value="providers" class="mt-4">
            <section aria-labelledby="providers-heading">
              <div class="mb-6">
                <h2 id="providers-heading" class="text-base font-semibold">模型厂商</h2>
                <p class="mt-1 text-sm text-muted-foreground">
                  管理各模型厂商的 API Key。凭据由系统安全存储加密，只保存在这台设备上。
                </p>
              </div>

              <Tabs
                default-value="apimart"
                orientation="vertical"
                class="gap-4 sm:flex-row sm:gap-8"
              >
                <TabsList
                  aria-label="模型厂商"
                  class="h-auto w-full shrink-0 flex-col items-stretch justify-start rounded-md p-1 sm:w-56"
                >
                  <TabsTrigger
                    value="apimart"
                    class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
                  >
                    <span class="font-medium">APIMart</span>
                    <span class="text-xs font-normal text-muted-foreground">生图模型厂商</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="deepseek"
                    class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
                  >
                    <span class="font-medium">DeepSeek</span>
                    <span class="text-xs font-normal text-muted-foreground">聊天模型厂商</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="minimax"
                    class="h-auto w-full flex-none flex-col items-start justify-center gap-0.5 px-3 py-3 text-left"
                  >
                    <span class="font-medium">MiniMax</span>
                    <span class="text-xs font-normal text-muted-foreground">聊天模型厂商</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="apimart" class="min-w-0 flex-1 sm:mt-0">
                  <div class="rounded-md border">
                    <ApimartKey />
                  </div>
                </TabsContent>

                <TabsContent value="deepseek" class="min-w-0 flex-1 sm:mt-0">
                  <div class="rounded-md border">
                    <DeepseekKey />
                  </div>
                </TabsContent>

                <TabsContent value="minimax" class="min-w-0 flex-1 sm:mt-0">
                  <div class="rounded-md border">
                    <MinimaxKey />
                  </div>
                </TabsContent>
              </Tabs>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </ScrollArea>
  </main>
</template>
