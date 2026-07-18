<script setup lang="ts">
import type { ChatStatus } from 'ai';
import { Bot, Check, ListChecks, PencilLine } from 'lucide-vue-next';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Loader } from '@/components/ai-elements/loader';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool';
import type { IllustrationAgentMessage } from '@/types';

defineProps<{
  messages: IllustrationAgentMessage[];
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'suggest', text: string): void;
}>();

const startingSuggestions = [
  '画当前角色在深夜赶稿，窗外正在下雨',
  '我有一篇文章需要配图，帮我一起确定画面',
  '先不画角色，我想创作一张有叙事感的纯场景',
];
</script>

<template>
  <Conversation class="min-h-0 flex-1">
    <ConversationContent class="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
      <ConversationEmptyState
        v-if="messages.length === 0"
        title="先说说你想画什么"
        description="Agent 会通过对话整理画面，不需要从头编写提示词。"
        class="min-h-[22rem]"
      >
        <template #icon>
          <Bot class="size-8" />
        </template>
        <Suggestions class="mt-3 flex-wrap justify-center">
          <Suggestion
            v-for="suggestion in startingSuggestions"
            :key="suggestion"
            :suggestion="suggestion"
            @click="emit('suggest', $event)"
          />
        </Suggestions>
      </ConversationEmptyState>

      <Message v-for="message in messages" :key="message.id" :from="message.role">
        <MessageContent class="w-full">
          <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
            <MessageResponse v-if="part.type === 'text'" :content="part.text" />

            <Tool v-else-if="part.type === 'tool-updateIllustrationBrief'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="整理画面草稿" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <PencilLine class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available'">已同步更新右侧画面方案</span>
                  <span v-else>正在整理已经确认的画面信息</span>
                </div>
              </ToolContent>
            </Tool>

            <Tool v-else-if="part.type === 'tool-presentIllustrationPlan'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="完成画面方案" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <Check
                    v-if="part.state === 'output-available' && part.output.ready"
                    class="mt-0.5 size-4 shrink-0"
                  />
                  <ListChecks v-else class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available' && part.output.ready">
                    画面方案已完成，可在右侧确认并生图
                  </span>
                  <span v-else>正在生成可供确认的完整方案</span>
                </div>
              </ToolContent>
            </Tool>
          </template>
        </MessageContent>
      </Message>

      <div
        v-if="status === 'submitted'"
        class="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Loader />
        Agent 正在整理画面
      </div>
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
</template>
