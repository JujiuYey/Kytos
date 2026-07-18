<script setup lang="ts">
import { Images, Laugh, SlidersHorizontal, Upload, WandSparkles } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
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
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Laugh class="size-4" />
    </div>
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="truncate text-sm font-semibold">表情管理</h1>
        <Badge variant="outline" class="hidden sm:inline-flex">GPT-Image-2</Badge>
      </div>
      <p class="truncate text-xs text-muted-foreground">基于正式角色资产生成与管理表情</p>
    </div>
  </div>

  <div class="flex flex-wrap items-center justify-end gap-2">
    <Button size="sm" variant="outline" @click="emit('upload')">
      <Upload class="size-4" />
      上传表情
    </Button>
    <Button size="sm" :variant="generatorOpen ? 'secondary' : 'default'" @click="emit('ai-create')">
      <WandSparkles class="size-4" />
      AI 创建
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
