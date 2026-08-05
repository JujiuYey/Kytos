<script setup lang="ts">
import { Images, SlidersHorizontal, Upload, WandSparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';

defineProps<{
  generatorOpen: boolean;
  mobilePane: 'settings' | 'gallery';
}>();

const emit = defineEmits<{
  (event: 'ai-create'): void;
  (event: 'upload'): void;
  (event: 'update:mobilePane', value: 'settings' | 'gallery'): void;
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

  <div v-if="generatorOpen" class="flex items-center gap-1 lg:hidden">
    <Button
      size="icon"
      :variant="mobilePane === 'settings' ? 'secondary' : 'ghost'"
      aria-label="显示设置"
      @click="emit('update:mobilePane', 'settings')"
    >
      <SlidersHorizontal class="size-4" />
    </Button>
    <Button
      size="icon"
      :variant="mobilePane === 'gallery' ? 'secondary' : 'ghost'"
      aria-label="显示表情"
      @click="emit('update:mobilePane', 'gallery')"
    >
      <Images class="size-4" />
    </Button>
  </div>
</template>
