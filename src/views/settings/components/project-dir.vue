<script setup lang="ts">
// import { open } from '@tauri-apps/plugin-dialog';
// import { FolderOpen } from 'lucide-vue-next';
// import { useGachaStore } from '@/stores/gacha';

// const store = useGachaStore();

// async function chooseProjectDir() {
//   const selected = await open({ directory: true, multiple: false });
//   if (typeof selected === 'string') {
//     store.projectRoot = selected;
//     await store.scanProject();
//   }
// }
</script>

<template>
  <div>12312</div>
  <!--
    <section class="space-y-3">
    <h2 class="text-sm font-medium text-muted-foreground">
    项目目录
    </h2>
    <div class="flex gap-2">
    <Input
    :model-value="store.projectRoot"
    placeholder="选一个项目根目录（一般是 ~/Desktop/角色抽卡）"
    readonly
    class="flex-1 font-mono text-sm"
    />
    <Button variant="outline" @click="chooseProjectDir">
    <FolderOpen class="size-4" />
    浏览
    </Button>
    </div>
    <p class="text-xs text-muted-foreground">
    类目从目录里扫出来（含 <code>prompt/</code> 的子目录就算一个类目）。
    </p>
    </section>
  -->
</template>
