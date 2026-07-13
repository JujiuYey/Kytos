<script setup lang="ts">
import { useGachaStore } from '@/stores/gacha';
import SeedList from './components/seed-list.vue';
import SeedEditor from './components/seed-editor.vue';

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
      <p class="text-sm text-muted-foreground">
        正在扫描…
      </p>
    </div>

    <div v-else class="h-full">
      <ResizablePanelGroup direction="horizontal" class="h-full">
        <ResizablePanel :default-size="30" :min-size="20" :max-size="45">
          <SeedList />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel :default-size="70" :min-size="40">
          <SeedEditor />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
</template>
