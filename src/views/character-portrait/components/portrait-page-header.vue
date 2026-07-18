<script setup lang="ts">
import {
  Camera,
  Check,
  ChevronDown,
  Images,
  SlidersHorizontal,
  Upload,
  WandSparkles,
} from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type WorkspaceStage = 'portrait' | 'sheet';

defineProps<{
  activeStage: WorkspaceStage;
  assetCount: number;
  generatorOpen: boolean;
  mobilePane: 'settings' | 'gallery';
}>();

const emit = defineEmits<{
  (event: 'ai-create', value: WorkspaceStage): void;
  (event: 'upload', value: WorkspaceStage): void;
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

  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button size="sm" variant="outline">
        <Upload class="size-4" />
        上传
        <ChevronDown class="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuItem @select="emit('upload', 'portrait')">
        <Camera class="size-4" />
        上传定妆照
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('upload', 'sheet')">
        <Images class="size-4" />
        上传角色表
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button size="sm" :variant="generatorOpen ? 'secondary' : 'default'">
        <WandSparkles class="size-4" />
        创建
        <ChevronDown class="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-48">
      <DropdownMenuItem @select="emit('ai-create', 'portrait')">
        <Camera class="size-4" />
        创建定妆照
        <Check v-if="activeStage === 'portrait' && generatorOpen" class="ml-auto size-4" />
      </DropdownMenuItem>
      <DropdownMenuItem @select="emit('ai-create', 'sheet')">
        <Images class="size-4" />
        创建角色表
        <Check v-if="activeStage === 'sheet' && generatorOpen" class="ml-auto size-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <div class="flex items-center gap-1 lg:hidden">
    <Button
      v-if="generatorOpen"
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
