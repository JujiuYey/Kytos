<script setup lang="ts">
import type { ChatStatus } from 'ai';
import { Sparkles } from '@lucide/vue';
import { toast } from 'vue-sonner';
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
import CharacterChatAttachmentButton from './character-chat-attachment-button.vue';
import CharacterChatAttachmentList from './character-chat-attachment-list.vue';

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_FILES = 3;

const props = defineProps<{
  disabled: boolean;
  drawBusy: boolean;
  drawDisabled: boolean;
  drawDisabledReason: string;
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'draw'): void;
  (event: 'send', message: PromptInputMessage): void;
  (event: 'stop'): void;
}>();

function handleSubmit(message: PromptInputMessage) {
  const text = message.text.trim();
  const files = message.files
    .filter(file => file.mediaType.startsWith('image/'))
    .map(file => ({
      filename: file.filename,
      mediaType: file.mediaType,
      type: 'file' as const,
      url: file.url,
    }));
  if ((!text && files.length === 0) || props.disabled || props.status !== 'ready') {
    return;
  }
  emit('send', { files, text });
}

function handleAttachmentError(error: { code: string; message: string }) {
  const messages: Record<string, string> = {
    accept: '仅支持 JPG、PNG、WebP 和 GIF 图片',
    max_file_size: '单张图片不能超过 8 MB',
    max_files: '一次最多上传 3 张图片',
  };
  toast.error(messages[error.code] ?? error.message);
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
    <PromptInputProvider
      :accept="ACCEPTED_IMAGE_TYPES"
      :max-file-size="MAX_IMAGE_FILE_SIZE"
      :max-files="MAX_IMAGE_FILES"
      @error="handleAttachmentError"
      @submit="handleSubmit"
    >
      <PromptInput
        :accept="ACCEPTED_IMAGE_TYPES"
        class="mx-auto w-full max-w-3xl"
        :max-file-size="MAX_IMAGE_FILE_SIZE"
        :max-files="MAX_IMAGE_FILES"
        multiple
      >
        <PromptInputBody>
          <CharacterChatAttachmentList />
          <PromptInputTextarea
            class="scrollbar-subtle"
            placeholder="描述角色，或者回答 Agent 的问题…"
            :disabled="props.disabled"
          />
        </PromptInputBody>
        <PromptInputFooter class="flex items-center justify-between gap-3">
          <PromptInputTools class="min-w-0">
            <CharacterChatAttachmentButton />
            <PromptInputButton
              :disabled="drawDisabled"
              :title="drawDisabledReason"
              @click="emit('draw')"
            >
              <Sparkles class="size-4" />
              <span>{{ drawBusy ? '正在抽卡' : '抽卡' }}</span>
            </PromptInputButton>
            <span class="min-w-0 truncate text-xs text-muted-foreground">
              {{ props.disabled ? '请先配置 DeepSeek API Key' : '可以发送文字或人物参考图片' }}
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
