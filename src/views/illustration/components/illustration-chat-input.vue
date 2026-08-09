<script setup lang="ts">
import type { ChatStatus } from 'ai';
import type { FileUIPart } from 'ai';
import { Images, X } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import {
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuItem,
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import type { CharacterVisualImage } from '@/types';
import { Button } from '@/components/ui/button';
import IllustrationChatAttachments from './illustration-chat-attachments.vue';

const props = defineProps<{
  adjustmentBase: {
    image: CharacterVisualImage;
    label: string;
  } | null;
  disabled: boolean;
  providerName: string;
  references: { key: string }[];
  supportsImageInput: boolean;
  status: ChatStatus;
  uploading: boolean;
}>();

const emit = defineEmits<{
  (event: 'send', payload: { files: FileUIPart[]; text: string }): void;
  (event: 'clear-adjustment'): void;
  (event: 'stop'): void;
  (event: 'open-library'): void;
}>();

function handleSubmit(message: PromptInputMessage): void {
  const text = message.text.trim();
  if (
    (!text && !message.files.length && !props.references.length && !props.adjustmentBase) ||
    props.disabled ||
    props.status !== 'ready'
  ) {
    return;
  }
  emit('send', {
    files: message.files,
    text: text || '请分析这些参考图，提炼并保持它们的画面风格。',
  });
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
        <PromptInputHeader
          v-if="adjustmentBase"
          class="flex-nowrap justify-between gap-3 border-b px-3 py-2"
        >
          <div class="flex min-w-0 items-center gap-2">
            <AiImage
              :src="adjustmentBase.image.url"
              :alt="`正在调整 ${adjustmentBase.label}`"
              class="size-10 shrink-0 rounded object-cover"
            />
            <div class="min-w-0">
              <p class="truncate text-xs font-medium">正在基于 {{ adjustmentBase.label }} 调整</p>
              <p class="truncate text-[11px] text-muted-foreground">
                该版本图片会随消息发送给 Agent
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            class="size-8 shrink-0"
            :disabled="disabled || status !== 'ready'"
            :aria-label="`停止调整${adjustmentBase.label}`"
            @click="emit('clear-adjustment')"
          >
            <X class="size-4" />
          </Button>
        </PromptInputHeader>
        <PromptInputBody>
          <IllustrationChatAttachments />
          <PromptInputTextarea
            class="scrollbar-subtle"
            :placeholder="
              adjustmentBase
                ? `描述${adjustmentBase.label}需要调整的地方…`
                : '描述想画的情境，或回答 Agent 的问题…'
            "
            :disabled="disabled"
          />
        </PromptInputBody>
        <PromptInputFooter class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-1">
            <PromptInputActionMenu v-if="supportsImageInput">
              <PromptInputActionMenuTrigger aria-label="添加图片" />
              <PromptInputActionMenuContent>
                <PromptInputActionMenuItem @select.prevent="emit('open-library')">
                  <Images class="mr-2 size-4" />
                  从素材库选择
                </PromptInputActionMenuItem>
                <PromptInputActionAddAttachments label="上传图片" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <span class="truncate text-xs text-muted-foreground">
              {{
                uploading
                  ? '正在保存参考图…'
                  : !supportsImageInput
                    ? `${providerName} 当前不支持图片输入`
                    : disabled
                      ? `请先配置 ${providerName} API Key`
                      : 'Agent 会同步整理右侧画面方案'
              }}
            </span>
          </div>
          <PromptInputSubmit :status="status" :disabled="disabled" @click="handleSubmitClick" />
        </PromptInputFooter>
      </PromptInput>
    </PromptInputProvider>
  </div>
</template>
