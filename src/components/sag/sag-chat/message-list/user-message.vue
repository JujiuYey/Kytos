<script setup lang="ts">
import { User, Copy } from 'lucide-vue-next';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { Message as MessageType } from '@/types';
import { copyToClipboard, formatTimestamp } from '@/utils/helpers';
import { toast } from 'vue-sonner';

interface Props {
  message: MessageType;
  isLast?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isLast: false,
});

async function handleCopy() {
  const success = await copyToClipboard(props.message.content);
  if (success) {
    toast.success('消息已复制到剪贴板');
  } else {
    toast.error('复制失败');
  }
}
</script>

<template>
  <div class="w-full flex justify-end mb-4">
    <div class="flex max-w-[85%] gap-3 flex-row group">
      <!-- 用户头像 -->
      <Avatar class="h-8 w-8 shrink-0 mt-1 order-last">
        <AvatarFallback class="bg-blue-500 text-white">
          <User class="h-4 w-4" />
        </AvatarFallback>
      </Avatar>

      <!-- 用户消息气泡 -->
      <div class="relative order-first">
        <div class="relative px-4 py-3 rounded-2xl max-w-none shadow-sm bg-blue-500 text-white rounded-tr-md">
          <!-- 用户消息 -->
          <div class="whitespace-pre-wrap break-words leading-relaxed">
            {{ message.content }}
          </div>
        </div>

        <!-- 时间戳和操作按钮 -->
        <div class="flex items-center gap-2 mt-1 justify-end">
          <span class="text-xs text-gray-500 dark:text-gray-400">
            {{ formatTimestamp(message.timestamp) }}
          </span>

          <Button
            v-if="message.content"
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
