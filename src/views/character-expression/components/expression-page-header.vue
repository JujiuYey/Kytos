<script setup lang="ts">
import { Upload, WandSparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';

defineProps<{
  generatorOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'ai-create'): void;
  (event: 'upload'): void;
}>();
</script>

<template>
  <div class="flex flex-wrap items-center justify-end gap-2">
    <Button size="sm" variant="outline" @click="emit('upload')">
      <Upload class="size-4" />
      上传表情
    </Button>
    <Button size="sm" :variant="generatorOpen ? 'secondary' : 'default'" @click="emit('ai-create')">
      <WandSparkles class="size-4" />
      创建
    </Button>
  </div>
</template>
