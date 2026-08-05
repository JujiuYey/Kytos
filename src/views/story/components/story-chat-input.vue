<script setup lang="ts">
import type { ChatStatus } from 'ai';
import type { FileUIPart } from 'ai';
import {
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';

const props = defineProps<{
  disabled: boolean;
  providerName: string;
  supportsImageInput: boolean;
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'send', payload: { files: FileUIPart[]; text: string }): void;
  (event: 'stop'): void;
}>();

function handleSubmit(message: PromptInputMessage): void {
  const text = message.text.trim();
  if (!text || props.disabled || props.status !== 'ready') {
    return;
  }
  emit('send', { files: message.files, text });
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
    <PromptInputProvider
      :accept="supportsImageInput ? 'image/*' : 'application/none'"
      :max-file-size="10 * 1024 * 1024"
      :max-files="4"
      @submit="handleSubmit"
    >
      <PromptInput
        class="mx-auto w-full max-w-3xl"
        :accept="supportsImageInput ? 'image/*' : 'application/none'"
        :max-file-size="10 * 1024 * 1024"
        :max-files="4"
        multiple
      >
        <PromptInputBody>
          <PromptInputTextarea
            class="scrollbar-subtle"
            placeholder="说说故事想法，或回答 Agent 的问题…"
            :disabled="disabled"
          />
        </PromptInputBody>
        <PromptInputFooter class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-1">
            <PromptInputActionMenu v-if="supportsImageInput">
              <PromptInputActionMenuTrigger aria-label="添加图片" />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="添加图片" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <span class="truncate text-xs text-muted-foreground">
              {{ disabled ? `请先配置 ${providerName} API Key` : 'Agent 会同步整理故事和分镜' }}
            </span>
          </div>
          <PromptInputSubmit :status="status" :disabled="disabled" @click="handleSubmitClick" />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  </div>
</template>
