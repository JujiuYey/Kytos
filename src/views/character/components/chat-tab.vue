<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RefreshCw, Sparkles } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';
import { useChatStore } from '@/stores/chat';

const project = useGachaStore();
const chat = useChatStore();

const projectLabel = computed(() => {
  const root = project.projectRoot;
  if (!root) {
    return 'IP';
  }
  const segs = root.split(/[\\/]/);
  return segs[segs.length - 1] || 'IP';
});

const noProject = computed(() => !project.projectRoot);
const noKey = computed(() => !project.project?.has_deepseek_key);
const assistantCount = computed(() => chat.messages.filter(m => m.role === 'assistant' && !m.failed).length);
const busy = computed(() => chat.phase === 'streaming-chat' || chat.phase === 'summarizing');

const canSummarize = computed(
  () => chat.phase === 'idle' && assistantCount.value > 0 && !noProject.value && !noKey.value,
);

onMounted(async () => {
  if (project.projectRoot) {
    await chat.enterChat(project.projectRoot);
  }
});

async function onSummarize() {
  await chat.summarize();
}

function onNewSession() {
  // eslint-disable-next-line no-alert
  const ok = window.confirm('清空当前对话？这不能撤销。');
  if (ok) {
    chat.resetSession();
    if (project.projectRoot) {
      void chat.enterChat(project.projectRoot);
    }
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div
      v-if="noProject"
      class="h-full flex items-center justify-center p-6 text-sm text-muted-foreground"
    >
      先去「设置」里选一个项目目录。
    </div>

    <template v-else>
      <header class="flex items-center gap-3 px-6 py-3 border-b">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <div class="size-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-medium">
            AI
          </div>
          <span class="font-medium truncate">{{ projectLabel }} 的 IP 助手</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          :disabled="!canSummarize"
          @click="onSummarize"
        >
          <Sparkles class="size-4" /> 让 DeepSeek 总结
        </Button>
        <Button
          variant="outline"
          size="sm"
          :disabled="busy"
          @click="onNewSession"
        >
          <RefreshCw class="size-4" /> 新会话
        </Button>
      </header>

      <div
        v-if="noKey"
        class="px-6 py-2 border-b bg-destructive/10 text-destructive text-sm"
      >
        还没配 DeepSeek key，去「设置」里加
      </div>

      <!-- placeholder for Conversation + PromptInput (Task 8 fills this in) -->
      <div class="flex-1 p-6 text-sm text-muted-foreground">
        对话区占位（下一步填）。chat messages: {{ chat.messages.length }}, phase: {{ chat.phase }}.
      </div>

      <div
        v-if="chat.lastError"
        class="px-6 py-2 border-t bg-destructive/10 text-destructive text-sm"
      >
        {{ chat.lastError }}
      </div>
    </template>
  </div>
</template>
