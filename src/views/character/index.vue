<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useGachaStore } from '@/stores/gacha';
import { useChatStore } from '@/stores/chat';

import CharacterChatHeader from './components/character-chat-header.vue';
import CharacterChatInput from './components/character-chat-input.vue';
import CharacterChatMessages from './components/character-chat-messages.vue';
import ChatSummaryPreview from './components/chat-summary-preview.vue';

const emit = defineEmits<{ (e: 'accepted'): void }>();

const project = useGachaStore();
const chat = useChatStore();

const noProject = computed(() => !project.projectRoot);
const noKey = computed(() => project.project !== null && !project.project.has_deepseek_key);
const projectLoaded = ref(false);
const assistantCount = computed(() => chat.messages.filter(m => m.role === 'assistant' && !m.failed).length);
const busy = computed(() => chat.phase === 'streaming-chat' || chat.phase === 'summarizing');

const canSummarize = computed(
  () => chat.phase === 'idle' && assistantCount.value > 0 && !noProject.value && !noKey.value,
);

onMounted(async () => {
  if (!project.projectRoot) {
    return;
  }
  await project.scanProject();
  projectLoaded.value = true;
  if (project.project) {
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

async function onSend(text: string) {
  await chat.sendUserMessage(text);
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

    <div
      v-else-if="!projectLoaded || project.isLoading"
      class="h-full flex items-center justify-center p-6 text-sm text-muted-foreground"
    >
      正在读取项目配置…
    </div>

    <div
      v-else-if="!project.project"
      class="h-full flex items-center justify-center p-6 text-sm text-destructive"
    >
      项目配置读取失败，请重新选择项目目录。
    </div>

    <template v-else>
      <CharacterChatHeader
        :can-summarize="canSummarize"
        :busy="busy"
        @summarize="onSummarize"
        @new-session="onNewSession"
      />

      <div
        v-if="noKey"
        class="px-6 py-2 border-b bg-destructive/10 text-destructive text-sm"
      >
        还没配 DeepSeek key，去「设置」里加
      </div>

      <CharacterChatMessages
        class="min-h-0 flex-1"
        :messages="chat.messages"
        :phase="chat.phase"
      />

      <ChatSummaryPreview
        v-if="chat.phase === 'preview'"
        @accept="onAcceptPreview"
        @cancel="onCancelPreview"
      />

      <CharacterChatInput :busy="busy" :no-key="noKey" @send="onSend" />

      <div
        v-if="chat.lastError"
        class="px-6 py-2 border-t bg-destructive/10 text-destructive text-sm"
      >
        {{ chat.lastError }}
      </div>
    </template>
  </div>
</template>
