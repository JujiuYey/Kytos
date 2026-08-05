<script setup lang="ts">
import { Images, MessageSquare, Plus, Trash2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { IllustrationTopic } from '@/types';

defineProps<{
  activeTopicId: string;
  busy: boolean;
  topicLocked: boolean;
  mobilePane: 'chat' | 'workspace';
  referencesReady: boolean;
  topics: IllustrationTopic[];
  useCharacter: boolean;
}>();

const emit = defineEmits<{
  (event: 'create'): void;
  (event: 'delete'): void;
  (event: 'select', topicId: string): void;
  (event: 'update:mobilePane', value: 'chat' | 'workspace'): void;
  (event: 'update:useCharacter', value: boolean): void;
}>();
</script>

<template>
  <Select
    :model-value="activeTopicId"
    :disabled="busy"
    @update:model-value="value => emit('select', String(value))"
  >
    <SelectTrigger class="min-w-0 flex-1 sm:max-w-56">
      <SelectValue placeholder="选择插画主题" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="topic in topics" :key="topic.id" :value="topic.id">
        {{ topic.title }}
      </SelectItem>
    </SelectContent>
  </Select>

  <Tabs
    :model-value="mobilePane"
    class="lg:hidden"
    @update:model-value="value => emit('update:mobilePane', value as 'chat' | 'workspace')"
  >
    <TabsList>
      <TabsTrigger value="chat" aria-label="显示对话">
        <MessageSquare class="size-3.5" />
      </TabsTrigger>
      <TabsTrigger value="workspace" aria-label="显示画面方案和版本">
        <Images class="size-3.5" />
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <div class="hidden items-center gap-2 md:flex">
    <Switch
      id="illustration-use-character"
      :model-value="useCharacter"
      :disabled="topicLocked"
      @update:model-value="emit('update:useCharacter', Boolean($event))"
    />
    <Label for="illustration-use-character" class="whitespace-nowrap text-xs">使用当前角色</Label>
    <SagStatusBadge v-if="useCharacter" :tone="referencesReady ? 'success' : 'error'">
      {{ referencesReady ? '角色参考就绪' : '缺少角色参考' }}
    </SagStatusBadge>
  </div>

  <Button
    size="icon"
    variant="ghost"
    :disabled="topicLocked"
    aria-label="删除当前插画主题"
    @click="emit('delete')"
  >
    <Trash2 class="size-4" />
  </Button>
  <Button size="sm" :disabled="busy" @click="emit('create')">
    <Plus class="size-4" />
    <span class="hidden sm:inline">新插画</span>
  </Button>
</template>
