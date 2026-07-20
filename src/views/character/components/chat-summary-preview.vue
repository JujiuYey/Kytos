<script setup lang="ts">
import { Check, FileCheck2, Loader2, Save } from '@lucide/vue';
import { MessageResponse } from '@/components/ai-elements/message';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

defineProps<{
  canSave: boolean;
  isSaving: boolean;
  markdown: string;
  saved: boolean;
}>();

const emit = defineEmits<{
  (event: 'save'): void;
}>();
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
      <div class="flex min-w-0 items-center gap-2">
        <FileCheck2 class="size-4 shrink-0 text-muted-foreground" />
        <span class="truncate text-sm font-medium">ip.md</span>
        <span v-if="saved" class="flex items-center gap-1 text-xs text-muted-foreground">
          <Check class="size-3.5" />
          已保存
        </span>
      </div>
      <Button size="sm" :disabled="!canSave || isSaving" @click="emit('save')">
        <Loader2 v-if="isSaving" class="size-4 animate-spin" />
        <Save v-else class="size-4" />
        保存完成稿
      </Button>
    </div>

    <ScrollArea v-if="markdown" class="min-h-0 flex-1">
      <MessageResponse :content="markdown" class="p-5 text-sm" />
    </ScrollArea>
    <div
      v-else
      class="flex min-h-0 flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground"
    >
      Agent 生成完成稿后会显示在这里。
    </div>
  </div>
</template>
