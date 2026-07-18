<script setup lang="ts">
import { Camera, Check, Images, SlidersHorizontal, WandSparkles } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CharacterPortraitSelection } from '@/types';

type WorkspaceStage = 'portrait' | 'sheet';

defineProps<{
  activeStage: WorkspaceStage;
  generatorOpen: boolean;
  mobilePane: 'settings' | 'gallery';
  selectedImage: CharacterPortraitSelection | null;
  selectedSheet: CharacterPortraitSelection | null;
}>();

const emit = defineEmits<{
  (event: 'ai-create'): void;
  (event: 'update:activeStage', value: WorkspaceStage): void;
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
        <Badge variant="outline" class="hidden sm:inline-flex">GPT-Image-2</Badge>
      </div>
      <p class="truncate text-xs text-muted-foreground">定妆照与多角度角色表</p>
    </div>
  </div>

  <Tabs
    :model-value="activeStage"
    class="order-3 w-full gap-0 sm:order-none sm:w-auto"
    @update:model-value="value => emit('update:activeStage', value as WorkspaceStage)"
  >
    <TabsList class="grid h-9 w-full grid-cols-2 sm:w-72">
      <TabsTrigger value="portrait" class="gap-1.5">
        <Camera class="size-3.5" />
        1. 定妆照
        <Check v-if="selectedImage" class="size-3.5 text-primary" />
      </TabsTrigger>
      <TabsTrigger value="sheet" class="gap-1.5">
        <Images class="size-3.5" />
        2. 角色表
        <Check v-if="selectedSheet" class="size-3.5 text-primary" />
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <Button size="sm" :variant="generatorOpen ? 'secondary' : 'default'" @click="emit('ai-create')">
    <WandSparkles class="size-4" />
    AI 创建
  </Button>

  <div class="flex items-center gap-1 lg:hidden">
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
      aria-label="显示图片"
      @click="emit('update:mobilePane', 'gallery')"
    >
      <Images class="size-4" />
    </Button>
  </div>
</template>
