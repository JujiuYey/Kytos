<script setup lang="ts">
import { Camera, Images, SlidersHorizontal, Upload, WandSparkles, Workflow } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type WorkspaceStage = 'portrait' | 'sheet';

defineProps<{
  assetCount: number;
  canvasOpen: boolean;
  cardOpen: boolean;
  mobilePane: 'settings' | 'gallery';
}>();

const emit = defineEmits<{
  (event: 'ai-create', value: WorkspaceStage): void;
  (event: 'upload'): void;
  (event: 'update:mobilePane', value: 'settings' | 'gallery'): void;
}>();
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Camera class="size-4" />
    </div>
    <div class="min-w-0">
      <div class="flex items-center gap-2">
        <h1 class="truncate text-sm font-semibold">角色视觉资产</h1>
        <Badge variant="secondary" class="shrink-0 tabular-nums">{{ assetCount }}</Badge>
      </div>
      <p class="truncate text-xs text-muted-foreground">统一查看和管理角色图片</p>
    </div>
  </div>

  <Button size="sm" variant="outline" @click="emit('upload')">
    <Upload class="size-4" />
    上传图片
  </Button>

  <Button
    size="sm"
    :variant="cardOpen ? 'secondary' : 'outline'"
    @click="emit('ai-create', 'portrait')"
  >
    <WandSparkles class="size-4" />
    创建卡片
  </Button>
  <Button
    size="sm"
    :variant="canvasOpen ? 'secondary' : 'outline'"
    @click="emit('ai-create', 'sheet')"
  >
    <Workflow class="size-4" />
    创建画布
  </Button>

  <div v-if="!canvasOpen" class="flex items-center gap-1 lg:hidden">
    <Button
      v-if="cardOpen"
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
      aria-label="显示图片"
      @click="emit('update:mobilePane', 'gallery')"
    >
      <Images class="size-4" />
    </Button>
  </div>
</template>
