<script setup lang="ts">
import type { ChatStatus } from 'ai';
import { BookOpen, Bot, Check, Clapperboard, PencilLine } from '@lucide/vue';
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
import type { StoryAgentMessage } from '@/types';

defineProps<{
  messages: StoryAgentMessage[];
  status: ChatStatus;
}>();

const emit = defineEmits<{
  (event: 'suggest', text: string): void;
}>();

const startingSuggestions = [
  '当前角色在一个雨夜完成一件一直不敢做的事',
  '我只有一个模糊的情绪，陪我聊成一个短故事',
  '帮我创作一个适合拆成五张插画的治愈故事',
];
</script>

<template>
  <Conversation class="scrollbar-subtle min-h-0 flex-1">
    <ConversationContent class="mx-auto w-full max-w-3xl gap-6 px-4 py-6 sm:px-6">
      <ConversationEmptyState
        v-if="messages.length === 0"
        title="先说说你想讲什么"
        description="Agent 会先把想法聊成短故事，再整理成 3 至 6 个连续分镜。"
        class="min-h-[22rem]"
      >
        <template #icon>
          <Bot class="size-8" />
        </template>
        <Suggestions class="mt-3 w-full max-w-full flex-wrap justify-center">
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

            <Tool v-else-if="part.type === 'tool-updateStoryDraft'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="整理故事草稿" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <PencilLine class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available'">已同步更新故事草稿</span>
                  <span v-else>正在整理已经确认的故事信息</span>
                </div>
              </ToolContent>
            </Tool>

            <Tool v-else-if="part.type === 'tool-presentStory'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="完成短篇故事" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <Check
                    v-if="part.state === 'output-available' && part.output.storyReady"
                    class="mt-0.5 size-4 shrink-0"
                  />
                  <BookOpen v-else class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available' && part.output.storyReady">
                    故事已完成，可以继续讨论或拆分镜
                  </span>
                  <span v-else>正在组织故事定稿</span>
                </div>
              </ToolContent>
            </Tool>

            <Tool v-else-if="part.type === 'tool-presentStoryboard'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="拆分文字分镜" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <Clapperboard class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available' && part.output.storyboardReady">
                    已整理 {{ part.output.shots.length }} 个分镜，可逐镜检查和生成
                  </span>
                  <span v-else>正在把故事拆成连续画面</span>
                </div>
              </ToolContent>
            </Tool>

            <Tool v-else-if="part.type === 'tool-updateStoryShot'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="调整分镜" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <PencilLine class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available'">分镜内容已同步更新</span>
                  <span v-else>正在调整指定分镜</span>
                </div>
              </ToolContent>
            </Tool>

            <Tool v-else-if="part.type === 'tool-confirmStoryboard'" class="mb-0">
              <ToolHeader :type="part.type" :state="part.state" title="确认当前分镜" />
              <ToolContent>
                <div
                  class="flex items-start gap-2 border-t px-3 py-3 text-sm text-muted-foreground"
                >
                  <Check class="mt-0.5 size-4 shrink-0" />
                  <span v-if="part.state === 'output-available'">分镜已确认，可以继续生图</span>
                  <span v-else>正在确认分镜状态</span>
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
        Agent 正在整理故事
      </div>
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
</template>
