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

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const DISABLED_IMAGE_INPUT_TYPE = 'application/x-kytos-image-input-disabled';
const IMAGE_INPUT_DISABLED = true;
const IMAGE_INPUT_DISABLED_REASON = '当前模型暂不支持图片输入';
const MAX_IMAGE_FILE_SIZE = 8 * 1024 * 1024;
const MAX_IMAGE_FILES = 3;
const MAX_IMAGE_DIMENSION = 2048;
const IMAGE_ANALYSIS_PROMPT =
  '请观察这些人物参考图片，先提取可见的形象锚点和视觉表现，再问我希望保留哪些部分。';

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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('无法读取参考图片'));
    image.src = url;
  });
}

async function normalizeImage(file: PromptInputMessage['files'][number]) {
  const image = await loadImage(file.url);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法处理参考图片');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const filename = file.filename?.replace(/\.[^.]+$/, '') || 'character-reference';
  return {
    filename: `${filename}.jpg`,
    mediaType: 'image/jpeg',
    type: 'file' as const,
    url: canvas.toDataURL('image/jpeg', 0.9),
  };
}

async function handleSubmit(message: PromptInputMessage) {
  const sourceFiles = message.files.filter(file => file.mediaType.startsWith('image/'));
  if (IMAGE_INPUT_DISABLED && sourceFiles.length) {
    toast.error(IMAGE_INPUT_DISABLED_REASON);
    return;
  }
  const text = message.text.trim() || (sourceFiles.length ? IMAGE_ANALYSIS_PROMPT : '');
  const files = await Promise.all(sourceFiles.map(normalizeImage));
  if ((!text && files.length === 0) || props.disabled || props.status !== 'ready') {
    return;
  }
  emit('send', { files, text });
}

function handleAttachmentError(error: { code: string; message: string }) {
  const messages: Record<string, string> = {
    accept: IMAGE_INPUT_DISABLED ? IMAGE_INPUT_DISABLED_REASON : '仅支持 JPG、PNG 和 WebP 图片',
    max_file_size: '单张图片不能超过 8 MB',
    max_files: '一次最多上传 3 张图片',
    submit_error: '参考图片处理失败，请更换图片后重试',
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
      :accept="IMAGE_INPUT_DISABLED ? DISABLED_IMAGE_INPUT_TYPE : ACCEPTED_IMAGE_TYPES"
      :max-file-size="MAX_IMAGE_FILE_SIZE"
      :max-files="MAX_IMAGE_FILES"
      @error="handleAttachmentError"
      @submit="handleSubmit"
    >
      <PromptInput
        :accept="IMAGE_INPUT_DISABLED ? DISABLED_IMAGE_INPUT_TYPE : ACCEPTED_IMAGE_TYPES"
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
            <CharacterChatAttachmentButton
              :disabled="IMAGE_INPUT_DISABLED"
              :disabled-reason="IMAGE_INPUT_DISABLED_REASON"
            />
            <PromptInputButton
              :disabled="drawDisabled"
              :title="drawDisabledReason"
              @click="emit('draw')"
            >
              <Sparkles class="size-4" />
              <span>{{ drawBusy ? '正在抽卡' : '抽卡' }}</span>
            </PromptInputButton>
            <span class="min-w-0 truncate text-xs text-muted-foreground">
              {{ props.disabled ? '请先配置 DeepSeek API Key' : IMAGE_INPUT_DISABLED_REASON }}
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
