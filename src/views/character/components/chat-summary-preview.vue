<script setup lang="ts">
import { computed } from 'vue';
import { MessageResponse } from '@/components/ai-elements/message';
import { useChatStore } from '@/stores/chat';

const emit = defineEmits<{
  (e: 'accept'): void;
  (e: 'cancel'): void;
}>();

const chat = useChatStore();
const draft = computed(() => {
  const last = chat.messages[chat.messages.length - 1];
  return last && last.role === 'assistant' ? last.content : '';
});
</script>

<template>
  <div class="border-t bg-muted/30 p-4 space-y-3">
    <header class="flex items-center justify-between">
      <h3 class="font-medium">
        DeepSeek 写出来的 ip.md 预览
      </h3>
      <div class="flex gap-2">
        <Button variant="outline" size="sm" @click="emit('cancel')">
          取消
        </Button>
        <Button size="sm" @click="emit('accept')">
          保存到 ip.md
        </Button>
      </div>
    </header>
    <div class="rounded border bg-background p-4 max-h-[40vh] overflow-auto">
      <MessageResponse :content="draft" />
    </div>
  </div>
</template>
