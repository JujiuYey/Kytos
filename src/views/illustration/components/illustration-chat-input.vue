<script setup lang="ts">
import type { ChatStatus } from 'ai';
import type { FileUIPart } from 'ai';
import { Images } from '@lucide/vue';
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
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import type { CharacterVisualImage } from '@/types';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import IllustrationChatAttachments from './illustration-chat-attachments.vue';

interface ChatReferencePreview {
  detail: string;
  editablePurpose: boolean;
  image: CharacterVisualImage;
  key: string;
  label: string;
  purpose: 'style' | 'content' | 'character';
}

const props = defineProps<{
  disabled: boolean;
  providerName: string;
  references: ChatReferencePreview[];
  supportsImageInput: boolean;
  status: ChatStatus;
  uploading: boolean;
}>();

const emit = defineEmits<{
  (event: 'send', payload: { files: FileUIPart[]; text: string }): void;
  (event: 'stop'): void;
  (event: 'open-library'): void;
  (event: 'set-reference-purpose', payload: { key: string; purpose: 'style' | 'content' }): void;
}>();

function handleSubmit(message: PromptInputMessage): void {
  const text = message.text.trim();
  if (
    (!text && !message.files.length && !props.references.length) ||
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
        <PromptInputBody>
          <ScrollArea v-if="references.length" class="max-h-24 px-3 pt-3">
            <div class="flex flex-wrap gap-2">
              <div
                v-for="reference in references"
                :key="reference.key"
                class="flex min-w-0 items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5"
              >
                <AiImage
                  :src="reference.image.url"
                  :alt="reference.label"
                  class="size-8 shrink-0 rounded object-cover"
                />
                <div class="min-w-0">
                  <p class="max-w-40 truncate text-xs font-medium">{{ reference.label }}</p>
                  <p v-if="!reference.editablePurpose" class="text-[11px] text-muted-foreground">
                    {{
                      reference.purpose === 'style'
                        ? '风格基准'
                        : reference.purpose === 'character'
                          ? '角色参考'
                          : '内容参考'
                    }}
                  </p>
                  <DropdownMenu v-else>
                    <DropdownMenuTrigger as-child>
                      <Button
                        variant="ghost"
                        size="sm"
                        class="h-5 px-1 text-[11px] font-normal text-muted-foreground"
                      >
                        {{ reference.purpose === 'style' ? '风格基准' : '内容参考' }}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        @select="
                          emit('set-reference-purpose', { key: reference.key, purpose: 'style' })
                        "
                      >
                        风格基准
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        @select="
                          emit('set-reference-purpose', { key: reference.key, purpose: 'content' })
                        "
                      >
                        内容参考
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </ScrollArea>
          <IllustrationChatAttachments />
          <PromptInputTextarea
            class="scrollbar-subtle"
            placeholder="描述想画的情境，或回答 Agent 的问题…"
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
