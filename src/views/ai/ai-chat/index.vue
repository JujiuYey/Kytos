<script lang="ts" setup>
import { ref } from 'vue';
import Sidebar from './sider/index.vue';
import { useOllamaConfig } from '@/stores/ollama-config';
import SagChat from '@/components/sag/sag-chat/index.vue';

const appStore = useOllamaConfig();
const isOllamaConfigured = computed(() => {
  return appStore.configs.ollamaUrl && appStore.configs.selectedModel;
});

const chatRef = ref<InstanceType<typeof SagChat>>();
</script>

<template>
  <ResizablePanelGroup direction="horizontal">
    <ResizablePanel
      :min-size="15"
      :max-size="20"
    >
      <Sidebar />
    </ResizablePanel>

    <ResizableHandle with-handle />

    <ResizablePanel>
      <div v-if="!isOllamaConfigured" class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <h2 class="text-xl font-semibold mb-2">
            配置 Ollama
          </h2>
          <p class="text-muted-foreground mb-4">
            请先在设置中配置 Ollama 服务器地址和模型
          </p>
        </div>
      </div>

      <SagChat v-else ref="chatRef" />
    </ResizablePanel>
  </ResizablePanelGroup>
</template>
