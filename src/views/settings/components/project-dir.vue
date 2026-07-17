<script setup lang="ts">
import { FolderOpen } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

async function chooseProjectDir() {
  const selected = await window.desktop.selectDirectory();
  if (selected) {
    appStore.updateSettings({ storagePath: selected });
  }
}
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
      项目目录
    </h2>
    <div class="flex gap-2">
      <Input
        :model-value="appStore.settings.storagePath"
        placeholder="选一个项目根目录（一般是 ~/Desktop/角色抽卡）"
        readonly
        class="flex-1 font-mono text-sm"
      />
      <Button variant="outline" @click="chooseProjectDir">
        <FolderOpen class="size-4" />
        浏览
      </Button>
    </div>
  </section>
</template>
