<script setup lang="ts">
import { computed } from 'vue';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import MarkdownRenderer from '@/components/markdown-renderer.vue';
import type { ChatMessage, ChatPhase } from '@/stores/chat';

const props = defineProps<{
  messages: ChatMessage[];
  phase: ChatPhase;
}>();

const lastMessage = computed(() => props.messages[props.messages.length - 1]);
</script>

<template>
  <Conversation class="flex-1">
    <ConversationContent>
      <div
        v-if="props.messages.length === 0"
        class="flex items-center justify-center h-full text-sm text-muted-foreground"
      >
        让 DeepSeek 主动开场问第一个问题…
      </div>
      <Message
        v-for="message of props.messages"
        :key="message.id"
        :from="message.role"
      >
        <MessageContent>
          <Reasoning
            v-if="message.reasoning"
            :is-streaming="props.phase === 'streaming-chat' && message === lastMessage"
          >
            <ReasoningTrigger />
            <ReasoningContent :content="message.reasoning" />
          </Reasoning>
          <MarkdownRenderer
            v-if="message.role === 'assistant'"
            :content="message.content"
            :is-streaming="props.phase !== 'idle' && message === lastMessage && !message.failed"
          />
          <div
            v-else
            class="whitespace-pre-wrap break-words"
          >
            {{ message.content }}
          </div>
          <div
            v-if="message.failed"
            class="text-xs text-destructive mt-1"
          >
            {{ message.content }}
          </div>
        </MessageContent>
      </Message>
    </ConversationContent>
    <ConversationScrollButton />
  </Conversation>
</template>
