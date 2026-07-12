<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserMessage from './user-message.vue';
import AiMessage from './ai-message.vue';
import Empty from './empty.vue';

import { useConversationsStore } from '@/stores/conversations';

// 更新props接口
interface MessageListProps {
  // 等待响应状态
  isLoading?: boolean;
  // 流式响应状态
  isStreaming?: boolean;
  // 当前流式内容
  streamingContent?: string;
}

const props = withDefaults(defineProps<MessageListProps>(), {
  isLoading: false,
  isStreaming: false,
  streamingContent: '',
});

const scrollAreaRef = ref<HTMLDivElement>();
const bottomRef = ref<HTMLDivElement>();

const currentMessages = computed(() => {
  // 直接从store获取消息数据
  const { currentConversation } = useConversationsStore();
  return [...currentConversation?.messages || []];
});

// 自动滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (bottomRef.value) {
      bottomRef.value.scrollIntoView({ behavior: 'smooth' });
    }
  });
}

// 监听消息变化，自动滚动
watch(
  [currentMessages, () => props.isLoading, () => props.isStreaming, () => props.streamingContent],
  () => {
    scrollToBottom();
  },
  { deep: true },
);
</script>

<template>
  <Empty v-if="currentMessages.length === 0 && !isLoading" />

  <ScrollArea v-else ref="scrollAreaRef" class="flex-1 bg-gray-50/30 dark:bg-gray-900/30">
    <div class="max-w-4xl mx-auto px-4 py-6">
      <!-- 消息列表 -->
      <template v-for="(message, index) of currentMessages" :key="message.id">
        <UserMessage
          v-if="message.role === 'user'"
          :message="message"
          :is-last="index === currentMessages.length - 1"
        />
        <AiMessage
          v-else
          :message="message"
          :is-last="index === currentMessages.length - 1"
          :is-loading="isLoading && index === currentMessages.length - 1"
          :is-streaming="isStreaming && index === currentMessages.length - 1"
          :streaming-content="isStreaming && index === currentMessages.length - 1 ? streamingContent : undefined"
        />
      </template>

      <!-- 如果没有AI消息但正在加载，显示一个占位的AiMessage -->
      <AiMessage
        v-if="isLoading && (currentMessages.length === 0 || currentMessages[currentMessages.length - 1]?.role === 'user')"
        :is-loading="true"
        :is-streaming="false"
      />

      <!-- 滚动锚点 -->
      <div ref="bottomRef" />
    </div>
  </ScrollArea>
</template>
