<script setup lang="ts">
import { Settings } from '@lucide/vue';
import ProjectDir from './components/project-dir/index.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import MinimaxKey from './components/minimax-key.vue';
import ModelSettings from './components/model-settings.vue';
import ThemeToggle from './components/theme/index.vue';
import { SagPage } from '@/components/sag/sag-page';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
</script>

<template>
  <Tabs default-value="basic" class="h-full min-h-0 gap-0">
    <SagPage
      title="系统设置"
      description="管理界面外观、本地作品目录、默认模型和模型厂商"
      :icon="Settings"
    >
      <template #header-actions>
        <TabsList aria-label="设置分类" class="shrink-0">
          <TabsTrigger value="basic">基本配置</TabsTrigger>
          <TabsTrigger value="defaults">默认模型</TabsTrigger>
          <TabsTrigger value="providers">模型厂商</TabsTrigger>
        </TabsList>
      </template>

      <ScrollArea class="min-h-0 flex-1">
        <div class="w-full px-6 py-8 lg:px-10 lg:py-10">
          <TabsContent value="basic" class="space-y-8">
            <ThemeToggle />
            <ProjectDir />
          </TabsContent>

          <TabsContent value="defaults">
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

          <TabsContent value="providers">
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
        </div>
      </ScrollArea>
    </SagPage>
  </Tabs>
</template>
