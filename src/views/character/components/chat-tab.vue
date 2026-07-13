<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RefreshCw, Sparkles } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';
import { useChatStore } from '@/stores/chat';
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Message, MessageContent } from '@/components/ai-elements/message';
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning';
import { PromptInput, PromptInputBody, PromptInputTextarea, PromptInputSubmit } from '@/components/ai-elements/prompt-input';
import { Loader } from '@/components/ai-elements/loader';
import MarkdownRenderer from '@/components/markdown-renderer.vue';

import ChatSummaryPreview from './chat-summary-preview.vue';

const emit = defineEmits<{ (e: 'accepted'): void }>();

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

const draft = ref('');

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

async function onSend() {
  const text = draft.value.trim();
  if (!text || busy.value || noKey.value) {
    return;
  }
  draft.value = '';
  await chat.sendUserMessage(text);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    void onSend();
  }
}

function onAcceptPreview() {
  chat.acceptSummary();
  emit('accepted');
}
function onCancelPreview() {
  chat.cancelPreview();
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

      <Conversation class="flex-1">
        <ConversationContent>
          <div
            v-if="chat.messages.length === 0"
            class="flex items-center justify-center h-full text-sm text-muted-foreground"
          >
            让 DeepSeek 主动开场问第一个问题…
          </div>
          <Message
            v-for="msg of chat.messages"
            :key="msg.id"
            :from="msg.role"
          >
            <MessageContent>
              <Reasoning v-if="msg.reasoning" :is-streaming="chat.phase === 'streaming-chat' && msg === chat.messages[chat.messages.length - 1]">
                <ReasoningTrigger />
                <ReasoningContent :content="msg.reasoning" />
              </Reasoning>
              <MarkdownRenderer
                v-if="msg.role === 'assistant'"
                :content="msg.content"
                :is-streaming="chat.phase !== 'idle' && msg === chat.messages[chat.messages.length - 1] && !msg.failed"
              />
              <div
                v-else
                class="whitespace-pre-wrap break-words"
              >
                {{ msg.content }}
              </div>
              <div
                v-if="msg.failed"
                class="text-xs text-destructive mt-1"
              >
                {{ msg.content }}
              </div>
            </MessageContent>
          </Message>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <ChatSummaryPreview
        v-if="chat.phase === 'preview'"
        @accept="onAcceptPreview"
        @cancel="onCancelPreview"
      />

      <PromptInput class="border-t" @submit="onSend">
        <PromptInputBody>
          <PromptInputTextarea
            v-model="draft"
            placeholder="跟 DeepSeek 聊聊这位角色…  (Enter 发送 / Shift+Enter 换行)"
            :disabled="busy || noKey"
            @keydown="onKeydown"
          />
          <PromptInputSubmit :disabled="busy || !draft.trim() || noKey">
            <Loader v-if="busy" class="size-4 animate-spin" />
            <span v-else>发送</span>
          </PromptInputSubmit>
        </PromptInputBody>
      </PromptInput>

      <div
        v-if="chat.lastError"
        class="px-6 py-2 border-t bg-destructive/10 text-destructive text-sm"
      >
        {{ chat.lastError }}
      </div>
    </template>
  </div>
</template>
