<script setup lang="ts">
import { computed } from 'vue';
import MarkdownRenderer from '@/components/markdown-renderer.vue';

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
}

const props = withDefaults(defineProps<MessageContentProps>(), {
  isStreaming: false,
});

// 处理think标签内容
function processThinkTags(text: string) {
  const thinkTagRegex = /<think>([\s\S]*?)<\/think>/g;
  const matches = Array.from(text.matchAll(thinkTagRegex));
  const parts = [];
  let lastIndex = 0;

  for (const match of matches) {
    if (match.index !== undefined && match.index > lastIndex) {
      parts.push({
        type: 'content',
        text: text.slice(lastIndex, match.index),
      });
    }

    parts.push({
      type: 'think',
      text: match[1]?.trim() || '',
    });

    lastIndex = (match.index || 0) + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'content',
      text: text.slice(lastIndex),
    });
  }

  return parts.length > 0 ? parts : [{ type: 'content', text }];
}

// 计算内容部分
const contentParts = computed(() => {
  return processThinkTags(props.content);
});
</script>

<template>
  <div class="message-content">
    <template v-for="(part, index) of contentParts" :key="index">
      <!-- Think标签内容 -->
      <details v-if="part.type === 'think'" class="my-4 border border-border rounded-lg overflow-hidden">
        <summary class="cursor-pointer px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-medium text-muted-foreground flex items-center gap-2 select-none">
          <span class="text-xs">🤔</span>
          AI 思考过程
        </summary>
        <div class="px-4 py-3 text-sm bg-muted/10">
          <MarkdownRenderer :content="part.text" class="text-muted-foreground" />
        </div>
      </details>

      <!-- 普通内容 -->
      <MarkdownRenderer v-else :content="part.text" :is-streaming="isStreaming" />
    </template>
  </div>
</template>

<style scoped>
/* Think区域的特殊样式 */
.message-content :deep(details[open] > summary) {
  border-bottom: 1px solid hsl(var(--border));
}
</style>
