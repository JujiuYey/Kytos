<script setup lang="ts">
import type { ChatStatus } from 'ai';
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
  disabled: boolean;
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'send', text: string): void;
  (event: 'stop'): void;
}>();

function handleSubmit(message: PromptInputMessage): void {
  const text = message.text.trim();
  if (!text || props.disabled || props.status !== 'ready') {
    return;
  }
  emit('send', text);
}

function handleSubmitClick(event: MouseEvent): void {
  if (props.status === 'submitted' || props.status === 'streaming') {
    event.preventDefault();
    emit('stop');
  }
}
</script>

<template>
  <div class="shrink-0 bg-background px-4 py-3 sm:px-5">
    <PromptInputProvider @submit="handleSubmit">
      <PromptInput class="mx-auto w-full max-w-3xl">
        <PromptInputBody>
          <PromptInputTextarea
            class="scrollbar-subtle"
            placeholder="说说故事想法，或回答 Agent 的问题…"
            :disabled="disabled"
          />
        </PromptInputBody>
        <PromptInputFooter class="flex items-center justify-between gap-3">
          <span class="min-w-0 truncate text-xs text-muted-foreground">
            {{ disabled ? '请先配置 DeepSeek API Key' : 'Agent 会同步整理故事和分镜' }}
          </span>
          <PromptInputSubmit :status="status" :disabled="disabled" @click="handleSubmitClick" />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  </div>
</template>
