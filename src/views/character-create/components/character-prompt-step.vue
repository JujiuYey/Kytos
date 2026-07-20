<script setup lang="ts">
import { computed } from 'vue';
import type { ChatStatus } from 'ai';
import { Bot, WandSparkles } from '@lucide/vue';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import CharacterPromptDraftPanel from './character-prompt-draft-panel.vue';
import type { CharacterPromptDraft, CharacterPromptMessage } from '../workflow-data';

const props = defineProps<{
  isResponding: boolean;
  draft: CharacterPromptDraft;
  messages: CharacterPromptMessage[];
  modelValue: string;
  styleName: string;
  suggestions: string[];
}>();

const emit = defineEmits<{
  (event: 'compile'): void;
  (event: 'send', value: string): void;
  (event: 'update:modelValue', value: string): void;
}>();

const chatStatus = computed<ChatStatus>(() => (props.isResponding ? 'submitted' : 'ready'));
const userAnswerCount = computed(
  () => props.messages.filter(message => message.role === 'user').length,
);

function handleSubmit(message: PromptInputMessage): void {
  const text = message.text.trim();
  if (!text || props.isResponding) return;
  emit('send', text);
}
</script>

<template>
  <section class="w-full" aria-labelledby="prompt-heading">
    <div class="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]">
      <div class="flex h-[32rem] min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
        <header class="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <div class="flex min-w-0 items-center gap-3">
            <div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Bot class="size-4" />
            </div>
            <div class="min-w-0">
              <h3 id="prompt-heading" class="truncate text-sm font-medium">形象访谈</h3>
              <p class="truncate text-xs text-muted-foreground">当前风格：{{ styleName }}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            class="shrink-0 gap-2"
            :disabled="userAnswerCount === 0 || isResponding"
            @click="emit('compile')"
          >
            <WandSparkles class="size-3.5" />
            {{ modelValue ? '重新整理' : '整理提示词' }}
          </Button>
        </header>

        <Conversation class="min-h-0 flex-1">
          <ConversationContent class="w-full gap-5 px-4 py-5 sm:px-5">
            <Message v-for="message in messages" :key="message.id" :from="message.role">
              <MessageContent class="w-full">
                <MessageResponse :content="message.content" />
              </MessageContent>
            </Message>

            <div v-if="isResponding" class="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader />
              正在整理你的回答
            </div>

            <Suggestions
              v-else-if="suggestions.length"
              class="w-full flex-wrap"
              aria-label="快捷回答"
            >
              <Suggestion
                v-for="suggestion in suggestions"
                :key="suggestion"
                :suggestion="suggestion"
                @click="emit('send', $event)"
              />
            </Suggestions>
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div class="shrink-0 border-t p-3 sm:p-4">
          <PromptInput class="w-full" @submit="handleSubmit">
            <PromptInputBody>
              <PromptInputTextarea
                class="min-h-14"
                placeholder="回答助手的问题，或者补充你在意的形象细节…"
                :disabled="isResponding"
              />
            </PromptInputBody>
            <PromptInputFooter class="flex items-center justify-between gap-3">
              <span class="text-xs text-muted-foreground">
                已记录 {{ userAnswerCount }} 条回答
              </span>
              <PromptInputSubmit :status="chatStatus" :disabled="isResponding" />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>

      <CharacterPromptDraftPanel :draft="draft" />
    </div>

    <div v-if="modelValue" class="mt-6">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <Label for="character-prompt">最终提示词</Label>
          <p class="mt-1 text-xs text-muted-foreground">已融合人物访谈与风格设定，可以继续微调</p>
        </div>
        <span class="shrink-0 text-xs text-muted-foreground"> {{ modelValue.length }} / 5000 </span>
      </div>
      <Textarea
        id="character-prompt"
        :model-value="modelValue"
        class="min-h-56 resize-y bg-background leading-6"
        @update:model-value="emit('update:modelValue', String($event).slice(0, 5000))"
      />
    </div>
  </section>
</template>
