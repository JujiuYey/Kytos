import { defineStore } from 'pinia';
import { nanoid } from 'nanoid';
import { ref } from 'vue';
import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { useContextStore } from '@/stores/context';
import { useGachaStore } from '@/stores/gacha';
import { useAppStore } from '@/stores/app';
import { chatIp, summarizeIp } from '@/lib/tauri/generation';
import { readContext } from '@/lib/tauri/context';
import type { ChatDelta, ChatMessage as BackendChatMessage } from '@/types/chat';

export type ChatRole = 'user' | 'assistant';

export type ChatPhase
  = | 'idle'
    | 'streaming-chat'
    | 'summarizing'
    | 'preview';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  reasoning: string;
  createdAt: number;
  failed?: boolean;
}

export interface SnapshotIp {
  capturedAt: number;
  content: string;
}

export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>([]);
  const phase = ref<ChatPhase>('idle');
  const lastError = ref('');
  const snapshotIp = ref<SnapshotIp | null>(null);
  const pendingRequestId = ref('');

  let deltaUnlisten: UnlistenFn | null = null;

  async function ensureListener() {
    if (deltaUnlisten) {
      return;
    }
    deltaUnlisten = await listen<ChatDelta>('deepseek://delta', event => onDelta(event.payload));
  }

  async function enterChat(root: string) {
    await ensureListener();
    if (snapshotIp.value) {
      return;
    }
    try {
      const ctx = await readContext(root);
      snapshotIp.value = { capturedAt: Date.now(), content: ctx.ip };
    } catch (e) {
      lastError.value = String(e);
    }
  }

  async function sendUserMessage(text: string) {
    const gacha = useGachaStore();
    const app = useAppStore();
    await ensureListener();
    if (phase.value !== 'idle') {
      return;
    }
    if (!gacha.projectRoot) {
      lastError.value = '先设置项目目录';
      return;
    }
    if (!gacha.project?.has_deepseek_key) {
      lastError.value = '还没配 DeepSeek key，去「设置」里加';
      return;
    }

    const userId = nanoid();
    const assistantId = nanoid();
    messages.value.push({ id: userId, role: 'user', content: text, reasoning: '', createdAt: Date.now() });
    messages.value.push({ id: assistantId, role: 'assistant', content: '', reasoning: '', createdAt: Date.now() });
    phase.value = 'streaming-chat';
    pendingRequestId.value = assistantId;
    lastError.value = '';

    const history: BackendChatMessage[] = [...messages.value.map(m => ({ role: m.role, content: m.content }))];

    try {
      await chatIp({
        root: gacha.projectRoot,
        history,
        model: app.settings.deepseekModel,
        request_id: assistantId,
      });
    } catch (e) {
      lastError.value = String(e);
      phase.value = 'idle';
      const target = messages.value.find(m => m.id === assistantId);
      if (target) {
        target.failed = true;
        target.content = `[error: ${String(e)}]`;
      }
    }
  }

  async function summarize() {
    const gacha = useGachaStore();
    const app = useAppStore();
    await ensureListener();
    if (!gacha.projectRoot) {
      lastError.value = '先设置项目目录';
      return;
    }
    if (phase.value !== 'idle') {
      return;
    }
    if (messages.value.filter(m => m.role === 'assistant' && !m.failed).length === 0) {
      lastError.value = '聊一聊再总结';
      return;
    }

    const summaryId = nanoid();
    messages.value.push({ id: summaryId, role: 'assistant', content: '', reasoning: '', createdAt: Date.now() });
    phase.value = 'summarizing';
    pendingRequestId.value = summaryId;
    lastError.value = '';

    const history: BackendChatMessage[] = messages.value.map(m => ({ role: m.role, content: m.content }));

    try {
      await summarizeIp({
        root: gacha.projectRoot,
        history,
        model: app.settings.deepseekModel,
        request_id: summaryId,
      });
      phase.value = 'preview';
    } catch (e) {
      lastError.value = String(e);
      phase.value = 'idle';
      const target = messages.value.find(m => m.id === summaryId);
      if (target) {
        target.failed = true;
        target.content = `[error: ${String(e)}]`;
      }
    }
  }

  function cancelPreview() {
    phase.value = 'idle';
  }

  function acceptSummary() {
    const target = messages.value[messages.value.length - 1];
    if (!target || target.role !== 'assistant' || phase.value !== 'preview') {
      return;
    }
    useContextStore().set('ip', target.content);
    phase.value = 'idle';
  }

  function resetSession() {
    messages.value = [];
    phase.value = 'idle';
    lastError.value = '';
    snapshotIp.value = null;
    pendingRequestId.value = '';
  }

  function onDelta(delta: ChatDelta) {
    if (delta.mode !== 'chat' && delta.mode !== 'summary') {
      return;
    }
    if (!delta.request_id || delta.request_id !== pendingRequestId.value) {
      return;
    }
    const target = messages.value.find(m => m.id === delta.request_id);
    if (!target) {
      return;
    }
    if (delta.content) {
      target.content += delta.content;
    }
    if (delta.reasoning) {
      target.reasoning += delta.reasoning;
    }
    // Phase is settled by sendUserMessage / summarize when their invoke
    // resolves or throws (try/catch paths). Delta events only mutate
    // message content; they don't transition phase.
  }

  return {
    messages,
    phase,
    lastError,
    snapshotIp,
    pendingRequestId,
    enterChat,
    sendUserMessage,
    summarize,
    cancelPreview,
    acceptSummary,
    resetSession,
    onDelta,
  };
});
