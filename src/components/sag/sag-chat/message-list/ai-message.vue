<script setup lang="ts">
import { computed } from 'vue';
import { Bot, Copy, Loader2 } from 'lucide-vue-next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Message as MessageType } from '@/types';
import { copyToClipboard, formatTimestamp } from '@/utils/helpers';
import { toast } from 'vue-sonner';
import MessageContent from './message-content.vue';

interface Props {
  // 可选，加载时可能没有消息
  message?: MessageType;
  isLast?: boolean;
  // 等待响应状态
  isLoading?: boolean;
  // 流式响应状态
  isStreaming?: boolean;
  // 流式内容
  streamingContent?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isLast: false,
  isLoading: false,
  isStreaming: false,
});

// 计算显示内容
const displayContent = computed(() => {
  if (props.isLoading) {
    // 加载状态不显示内容
    return '';
  }
  if (props.isStreaming && props.streamingContent !== undefined) {
    // 显示流式内容
    return props.streamingContent;
  }
  // 显示最终内容
  return props.message?.content || '';
});

// 计算显示状态
const showLoadingIndicator = computed(() => props.isLoading);
const showStreamingAnimation = computed(() => props.isStreaming);
const showTimestamp = computed(() => props.message?.timestamp && !props.isLoading);
const canCopy = computed(() => displayContent.value && !props.isLoading);

async function handleCopy() {
  const success = await copyToClipboard(displayContent.value);
  if (success) {
    toast.success('消息已复制到剪贴板');
  } else {
    toast.error('复制失败');
  }
}
</script>

<template>
  <div class="w-full flex justify-start mb-4">
    <div class="flex max-w-[85%] gap-3 flex-row group">
      <!-- AI头像 -->
      <Avatar class="h-8 w-8 shrink-0 mt-1 order-first">
        <AvatarFallback class="bg-gray-600 text-white dark:bg-gray-300 dark:text-gray-800">
          <Bot class="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <!-- AI消息气泡 -->
      <div class="relative">
        <div
          :class="`
            relative px-4 py-3 rounded-2xl max-w-none shadow-sm
            bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 rounded-bl-md border border-gray-200 dark:border-gray-700
            ${showStreamingAnimation ? 'animate-pulse' : ''}
          `"
        >
          <!-- 加载状态 -->
          <div v-if="showLoadingIndicator" class="flex items-center gap-2">
            <Loader2 class="h-4 w-4 animate-spin" />
            <span class="text-sm">AI助手正在思考...</span>
          </div>

          <!-- 消息内容 -->
          <MessageContent
            v-else
            :content="displayContent"
            :is-user="false"
            :is-streaming="isStreaming"
          />
        </div>

        <!-- 时间戳和操作按钮 -->
        <div v-if="showTimestamp || canCopy" class="flex items-center gap-2 mt-1 justify-start">
          <span v-if="showTimestamp" class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatTimestamp(message!.timestamp) }}
          </span>

          <Button
            v-if="canCopy"
            variant="ghost"
            size="sm"
            class="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            title="复制消息"
            @click="handleCopy"
          >
            <Copy class="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
