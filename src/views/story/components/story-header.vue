<script setup lang="ts">
import { BookMarked, BookOpen, Images, MessageSquare, Plus, Trash2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import type { StoryProject } from '@/types';

defineProps<{
  activeStoryId: string;
  assetsReady: boolean;
  busy: boolean;
  mobilePane: 'chat' | 'workspace';
  stories: StoryProject[];
}>();

const emit = defineEmits<{
  (event: 'create'): void;
  (event: 'delete'): void;
  (event: 'manage'): void;
  (event: 'select', storyId: string): void;
  (event: 'update:mobilePane', value: 'chat' | 'workspace'): void;
}>();
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <BookOpen class="size-4" />
    </div>
    <div class="hidden min-w-0 sm:block">
      <h1 class="truncate text-sm font-semibold">故事创作</h1>
      <p class="truncate text-xs text-muted-foreground">聊故事，拆分镜，逐张完成画面</p>
    </div>
    <Select
      :model-value="activeStoryId"
      :disabled="busy"
      @update:model-value="value => emit('select', String(value))"
    >
      <SelectTrigger class="min-w-0 flex-1 sm:ml-2 sm:max-w-56">
        <SelectValue placeholder="选择故事" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="story in stories" :key="story.id" :value="story.id">
          {{ story.title }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <Tabs
    :model-value="mobilePane"
    class="lg:hidden"
    @update:model-value="value => emit('update:mobilePane', value as 'chat' | 'workspace')"
  >
    <TabsList>
      <TabsTrigger value="chat" aria-label="显示故事对话">
        <MessageSquare class="size-3.5" />
      </TabsTrigger>
      <TabsTrigger value="workspace" aria-label="显示故事工作区">
        <Images class="size-3.5" />
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <SagStatusBadge :tone="assetsReady ? 'success' : 'error'" class="hidden md:flex">
    {{ assetsReady ? '正式参考就绪' : '缺少正式参考' }}
  </SagStatusBadge>

  <Button
    size="sm"
    variant="outline"
    :disabled="busy"
    aria-label="故事管理"
    @click="emit('manage')"
  >
    <BookMarked class="size-4" />
    <span class="hidden xl:inline">故事管理</span>
  </Button>
  <Button
    size="icon"
    variant="ghost"
    :disabled="busy"
    aria-label="删除当前故事"
    @click="emit('delete')"
  >
    <Trash2 class="size-4" />
  </Button>
  <Button size="sm" :disabled="busy" @click="emit('create')">
    <Plus class="size-4" />
    <span class="hidden sm:inline">新故事</span>
  </Button>
</template>
