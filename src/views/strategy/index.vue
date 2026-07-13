<script setup lang="ts">
import { onMounted } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import { useContextStore } from '@/stores/context';
import ContextEditor from '@/components/context-editor.vue';

const project = useGachaStore();
const context = useContextStore();

onMounted(async () => {
  if (project.projectRoot) {
    await context.load(project.projectRoot);
  }
});
</script>

<template>
  <ContextEditor
    kind="agents"
    label="策略"
    helper-text="提示词怎么写。写卡时作为 system prompt 发给 DeepSeek。"
  />
</template>
