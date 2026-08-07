<script setup lang="ts">
import { Settings } from '@lucide/vue';
import ProjectDir from './components/project-dir/index.vue';
import ResourceExport from './components/resource-export/index.vue';
import ModelSettings from './components/model-settings/index.vue';
import Providers from './components/providers/index.vue';
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
            <ResourceExport />
          </TabsContent>

          <TabsContent value="defaults">
            <ModelSettings />
          </TabsContent>

          <TabsContent value="providers">
            <Providers />
          </TabsContent>
        </div>
      </ScrollArea>
    </SagPage>
  </Tabs>
</template>
