<script setup lang="ts">
import type { ChatStatus } from 'ai';
import { Sparkles } from 'lucide-vue-next';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';

const props = defineProps<{
  disabled: boolean;
  drawBusy: boolean;
  drawDisabled: boolean;
  drawDisabledReason: string;
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'draw'): void;
  (event: 'send', text: string): void;
  (event: 'stop'): void;
}>();

function handleSubmit(message: PromptInputMessage) {
  const text = message.text.trim();
  if (!text || props.disabled || props.status !== 'ready') {
    return;
  }
  emit('send', text);
}

function handleSubmitClick(event: MouseEvent) {
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
            placeholder="描述角色，或者回答 Agent 的问题…"
            :disabled="props.disabled"
          />
        </PromptInputBody>
        <PromptInputFooter class="flex items-center justify-between gap-3">
          <PromptInputTools class="min-w-0">
            <PromptInputButton
              :disabled="drawDisabled"
              :title="drawDisabledReason"
              @click="emit('draw')"
            >
              <Sparkles class="size-4" />
              <span>{{ drawBusy ? '正在抽卡' : '抽卡' }}</span>
            </PromptInputButton>
            <span class="min-w-0 truncate text-xs text-muted-foreground">
              {{ props.disabled ? '请先配置 DeepSeek API Key' : 'Agent 会同步更新右侧草稿' }}
            </span>
          </PromptInputTools>
          <PromptInputSubmit
            :status="props.status"
            :disabled="props.disabled"
            @click="handleSubmitClick"
          />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  </div>
</template>
