<script setup lang="ts">
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';

const props = defineProps<{
  busy: boolean;
  noKey: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
}>();

function handleSubmit(message: PromptInputMessage) {
  const text = message.text.trim();
  if (!text || props.busy || props.noKey) {
    return;
  }
  emit('send', text);
}
</script>

<template>
  <div class="size-full bg-background px-4 py-3 sm:px-6">
    <PromptInputProvider @submit="handleSubmit">
      <PromptInput class="w-full">
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="聊聊这位角色…"
            :disabled="props.busy || props.noKey"
          />
        </PromptInputBody>
        <PromptInputFooter class="flex justify-end">
          <PromptInputSubmit
            :status="props.busy ? 'submitted' : 'ready'"
            :disabled="props.busy || props.noKey"
          />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  </div>
</template>
