<script setup lang="ts">
import { onMounted } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import PromptList from './components/prompt-list.vue';
import PromptEditor from './components/prompt-editor.vue';
import ImageGallery from './components/image-gallery.vue';

const store = useGachaStore();

onMounted(() => {
  if (store.projectRoot) {
    store.scanProject();
  }
});
</script>

<template>
  <div class="h-full">
    <div v-if="!store.projectRoot" class="h-full flex items-center justify-center">
      <div class="text-center space-y-3 max-w-md">
        <h2 class="text-lg font-semibold">
          还没设置项目目录
        </h2>
        <p class="text-sm text-muted-foreground">
          去「设置」里选一个项目目录（一般是 <code class="bg-muted px-1 rounded">~/Desktop/角色抽卡</code>）。
        </p>
      </div>
    </div>

    <div v-else-if="!store.project" class="h-full flex items-center justify-center">
      <div class="text-center space-y-3">
        <p class="text-sm text-muted-foreground">
          正在扫描 {{ store.projectRoot }}…
        </p>
      </div>
    </div>

    <div v-else class="h-full">
      <ResizablePanelGroup direction="horizontal" class="h-full">
        <ResizablePanel :default-size="22" :min-size="15" :max-size="35">
          <PromptList />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel :default-size="46" :min-size="30">
          <PromptEditor />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel :default-size="32" :min-size="20">
          <ImageGallery />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
</template>
