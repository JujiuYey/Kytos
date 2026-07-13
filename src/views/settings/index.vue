<script setup lang="ts">
import { onMounted } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import ProjectDir from './components/project-dir.vue';
import ApimartKey from './components/apimart-key.vue';
import DeepseekKey from './components/deepseek-key.vue';
import DeepseekModel from './components/deepseek-model.vue';

const store = useGachaStore();

onMounted(() => {
  if (store.projectRoot) {
    store.scanProject();
  }
});
</script>

<template>
  <div class="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
    <h1 class="text-2xl font-semibold">
      设置
    </h1>
    <ProjectDir />
    <ApimartKey />
    <DeepseekKey />
    <DeepseekModel />
  </div>
</template>
