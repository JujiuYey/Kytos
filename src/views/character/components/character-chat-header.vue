<script setup lang="ts">
import { Bot, FileText, MessageSquare, RotateCcw } from 'lucide-vue-next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

defineProps<{
  busy: boolean;
  keyConfigured: boolean;
  mobilePane: 'chat' | 'draft';
  model: string;
}>();

const emit = defineEmits<{
  (event: 'newSession'): void;
  (event: 'update:mobilePane', value: 'chat' | 'draft'): void;
}>();
</script>

<template>
  <header class="flex min-h-14 flex-wrap items-center gap-3 border-b px-4 py-2 sm:px-5">
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <div
        class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <Bot class="size-4" />
      </div>
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="truncate text-sm font-medium">角色共创 Agent</h1>
          <Badge :variant="keyConfigured ? 'secondary' : 'outline'">
            {{ keyConfigured ? 'DeepSeek 已连接' : '等待 API Key' }}
          </Badge>
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
      variant="ghost"
      size="icon"
      :disabled="busy"
      aria-label="开始新对话"
      title="开始新对话"
      @click="emit('newSession')"
    >
      <RotateCcw class="size-4" />
    </Button>
  </header>
</template>
