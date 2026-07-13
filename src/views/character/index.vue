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
    kind="ip"
    label="特征"
    helper-text="你的人物形象是谁、ta该演什么。写卡时作为 system prompt 发给 DeepSeek。"
  />
</template>
