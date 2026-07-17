<script setup lang="ts">
import { RefreshCw, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  canSummarize: boolean;
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'summarize'): void;
  (e: 'newSession'): void;
}>();
</script>

<template>
  <header class="flex items-center gap-3 px-6 py-3 border-b">
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <div class="size-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-medium">
        AI
      </div>
      <span class="font-medium truncate">创建角色 助手</span>
    </div>
    <Button
      variant="outline"
      size="sm"
      :disabled="!props.canSummarize"
      @click="emit('summarize')"
    >
      <Sparkles class="size-4" /> 让 DeepSeek 总结
    </Button>
    <Button
      variant="outline"
      size="sm"
      :disabled="props.busy"
      @click="emit('newSession')"
    >
      <RefreshCw class="size-4" /> 新会话
    </Button>
  </header>
</template>
