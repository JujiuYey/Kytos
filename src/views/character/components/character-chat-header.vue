<script setup lang="ts">
import { Bot, FileText, MessageSquare, RotateCcw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SagStatusBadge from '@/components/sag/status-badge.vue';

defineProps<{
  busy: boolean;
  keyConfigured: boolean;
  mobilePane: 'chat' | 'draft';
  model: string;
  workspaceOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'openWorkspace'): void;
  (event: 'newSession'): void;
  (event: 'update:mobilePane', value: 'chat' | 'draft'): void;
}>();
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Bot class="size-4" />
    </div>
    <div class="min-w-0">
      <div class="flex flex-wrap items-center gap-2">
        <h1 class="truncate text-sm font-medium">角色共创 Agent</h1>
        <SagStatusBadge :tone="keyConfigured ? 'success' : 'warning'">
          {{ keyConfigured ? 'DeepSeek 已连接' : '等待 API Key' }}
        </SagStatusBadge>
      </div>
      <p class="truncate text-xs text-muted-foreground">{{ model }}</p>
    </div>
  </div>

  <Tabs
    :model-value="mobilePane"
    class="lg:hidden"
    @update:model-value="value => emit('update:mobilePane', value as 'chat' | 'draft')"
  >
    <TabsList>
      <TabsTrigger value="chat">
        <MessageSquare class="size-3.5" />
        对话
      </TabsTrigger>
      <TabsTrigger value="draft">
        <FileText class="size-3.5" />
        角色档案
      </TabsTrigger>
    </TabsList>
  </Tabs>

  <Button
    size="sm"
    :variant="workspaceOpen ? 'secondary' : 'default'"
    @click="emit('openWorkspace')"
  >
    <FileText class="size-4" />
    角色档案
  </Button>

  <Button
    variant="ghost"
    size="icon"
    :disabled="busy"
    aria-label="开始新对话"
    title="开始新对话"
    @click="emit('newSession')"
  >
    <RotateCcw class="size-4" />
  </Button>
</template>
