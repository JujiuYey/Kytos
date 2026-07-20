<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { AlertCircle } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/stores/app';
import { SagPage } from '@/components/sag/sag-page';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import CharacterContextBar from '@/components/sag/character-context-bar.vue';
import type {
  ArtStyle,
  CharacterAgentMessage,
  CharacterDraft,
  CharacterDraftUpdateResult,
  CharacterProfileProposalResult,
  CharacterVisualCard,
  CharacterVisualCardDraw,
  CredentialStatus,
} from '@/types';
import {
  CHARACTER_AGENT_ENDPOINT,
  DEFAULT_DEEPSEEK_MODEL,
  createEmptyCharacterDraft,
} from '@/types';
import CharacterChatHeader from './components/character-chat-header.vue';
import CharacterChatInput from './components/character-chat-input.vue';
import CharacterChatMessages from './components/character-chat-messages.vue';
import CharacterVisualCardDialog from './components/character-visual-card-dialog.vue';
import CharacterWorkspacePanel from './components/character-workspace-panel.vue';

const appStore = useAppStore();
const draft = ref<CharacterDraft>(createEmptyCharacterDraft());
const artStyles = ref<ArtStyle[]>([]);
const visualDraws = ref<CharacterVisualCardDraw[]>([]);
const pollingStates = ref<GenerationPollingStateMap>({});
const savedProfileMarkdown = ref('');
const proposedProfileMarkdown = ref('');
const credentialStatus = ref<CredentialStatus | null>(null);
const imageCredentialStatus = ref<CredentialStatus | null>(null);
const initializationError = ref('');
const isInitializing = ref(true);
const isDrawing = ref(false);
const isVisualCardDialogOpen = ref(false);
const isResetDialogOpen = ref(false);
const isSaving = ref(false);
const isProfileSaved = ref(false);
const workspaceOpen = ref(true);
const mobilePane = ref<'chat' | 'draft'>('chat');
const selectedArtStyleId = ref('');
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
let disposed = false;

const model = computed(() => appStore.settings.deepseekModel.trim() || DEFAULT_DEEPSEEK_MODEL);
const profileMarkdown = computed(() => proposedProfileMarkdown.value || savedProfileMarkdown.value);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const imageKeyConfigured = computed(() => Boolean(imageCredentialStatus.value?.configured));
const hasCharacterSeed = computed(() =>
  [
    draft.value.concept,
    draft.value.personality,
    draft.value.motivation,
    draft.value.background,
  ].some(value => Boolean(value.trim())),
);

const transport = new DefaultChatTransport<CharacterAgentMessage>({
  api: CHARACTER_AGENT_ENDPOINT,
  body: { model: model.value },
});

const { clearError, error, messages, regenerate, sendMessage, status, stop } =
  useChat<CharacterAgentMessage>({
    transport,
    onFinish: () => {
      void refreshWorkspace().catch(refreshError => {
        initializationError.value =
          refreshError instanceof Error ? refreshError.message : String(refreshError);
      });
    },
  });

const chatStatus = computed<ChatStatus>(() => status.value);
const isBusy = computed(() => chatStatus.value === 'submitted' || chatStatus.value === 'streaming');
const isInputDisabled = computed(
  () => isInitializing.value || !keyConfigured.value || chatStatus.value === 'error',
);
const errorMessage = computed(() => initializationError.value || error.value?.message || '');
const drawDisabledReason = computed(() => {
  if (isInitializing.value) {
    return '正在载入角色工作区';
  }
  if (isBusy.value) {
    return '等待 Agent 回复完成后再抽卡';
  }
  if (isDrawing.value) {
    return '正在准备新一组视觉卡';
  }
  if (!keyConfigured.value) {
    return '请先配置 DeepSeek API Key';
  }
  if (!imageKeyConfigured.value) {
    return '请先配置 APIMart API Key';
  }
  if (!artStyles.value.length) {
    return '请先准备至少一种画风';
  }
  if (!hasCharacterSeed.value) {
    return '先聊出核心概念、性格、动机或背景中的至少一项';
  }
  return '';
});
const canDrawVisual = computed(() => !drawDisabledReason.value);

function isDraftUpdateResult(value: unknown): value is CharacterDraftUpdateResult {
  return Boolean(value && typeof value === 'object' && 'draft' in value);
}

function isProfileProposalResult(value: unknown): value is CharacterProfileProposalResult {
  return Boolean(value && typeof value === 'object' && 'markdown' in value && 'draft' in value);
}

function applyToolOutputs(messageList: CharacterAgentMessage[]) {
  for (const message of messageList) {
    for (const part of message.parts) {
      if (
        part.type === 'tool-updateCharacterDraft' &&
        part.state === 'output-available' &&
        isDraftUpdateResult(part.output)
      ) {
        draft.value = part.output.draft;
      }
      if (
        part.type === 'tool-completeCharacterProfile' &&
        part.state === 'output-available' &&
        isProfileProposalResult(part.output) &&
        part.output.ready
      ) {
        draft.value = part.output.draft;
        proposedProfileMarkdown.value = part.output.markdown;
        isProfileSaved.value = part.output.markdown === savedProfileMarkdown.value;
        mobilePane.value = 'draft';
      }
    }
  }
}

async function refreshWorkspace() {
  const workspace = await window.desktop.getCharacterWorkspace();
  draft.value = workspace.draft;
  savedProfileMarkdown.value = workspace.profileMarkdown ?? '';
  if (!proposedProfileMarkdown.value) {
    isProfileSaved.value = Boolean(workspace.profileMarkdown);
  }
}

async function initialize() {
  isInitializing.value = true;
  initializationError.value = '';
  try {
    const [workspace, statusResult, imageStatusResult, artStyleWorkspace, visualCardWorkspace] =
      await Promise.all([
        window.desktop.getCharacterWorkspace(),
        window.desktop.getCredentialStatus('deepseek'),
        window.desktop.getCredentialStatus('apimart'),
        window.desktop.getArtStyleWorkspace(),
        window.desktop.getCharacterVisualCardWorkspace(),
      ]);
    draft.value = workspace.draft;
    savedProfileMarkdown.value = workspace.profileMarkdown ?? '';
    isProfileSaved.value = Boolean(workspace.profileMarkdown);
    credentialStatus.value = statusResult;
    imageCredentialStatus.value = imageStatusResult;
    artStyles.value = artStyleWorkspace.styles;
    visualDraws.value = visualCardWorkspace.draws;
    selectedArtStyleId.value = artStyleWorkspace.styles[0]?.id ?? '';
    for (const draw of visualCardWorkspace.draws) {
      scheduleDrawPolling(draw);
    }
  } catch (initializationFailure: unknown) {
    initializationError.value =
      initializationFailure instanceof Error
        ? initializationFailure.message
        : String(initializationFailure);
  } finally {
    isInitializing.value = false;
  }
}

function replaceVisualDraw(draw: CharacterVisualCardDraw): void {
  visualDraws.value = [draw, ...visualDraws.value.filter(item => item.id !== draw.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function clearPollingState(cardId: string): void {
  const nextStates = { ...pollingStates.value };
  delete nextStates[cardId];
  pollingStates.value = nextStates;
}

function schedulePoll(drawId: string, cardId: string): void {
  const currentTimer = pollTimers.get(cardId);
  if (currentTimer) {
    clearTimeout(currentTimer);
  }
  const previousState = pollingStates.value[cardId];
  pollingStates.value = {
    ...pollingStates.value,
    [cardId]: { attempt: previousState?.attempt ?? 0, phase: 'waiting' },
  };
  pollTimers.set(
    cardId,
    setTimeout(() => {
      void pollVisualCard(drawId, cardId);
    }, 2500),
  );
}

function scheduleDrawPolling(draw: CharacterVisualCardDraw): void {
  for (const card of draw.cards) {
    if (card.taskId && ['submitted', 'pending', 'processing'].includes(card.status)) {
      schedulePoll(draw.id, card.id);
    }
  }
}

async function pollVisualCard(drawId: string, cardId: string): Promise<void> {
  if (disposed) {
    return;
  }
  const previousState = pollingStates.value[cardId];
  pollingStates.value = {
    ...pollingStates.value,
    [cardId]: { attempt: (previousState?.attempt ?? 0) + 1, phase: 'requesting' },
  };
  try {
    const draw = await window.desktop.getCharacterVisualCardTask({ cardId, drawId });
    if (disposed) {
      return;
    }
    replaceVisualDraw(draw);
    const card = draw.cards.find(item => item.id === cardId);
    if (card && ['submitted', 'pending', 'processing'].includes(card.status)) {
      schedulePoll(drawId, cardId);
      return;
    }
    pollTimers.delete(cardId);
    clearPollingState(cardId);
  } catch (pollError: unknown) {
    pollTimers.delete(cardId);
    pollingStates.value = {
      ...pollingStates.value,
      [cardId]: {
        attempt: pollingStates.value[cardId]?.attempt ?? 1,
        phase: 'paused',
      },
    };
    toast.error(pollError instanceof Error ? pollError.message : String(pollError));
  }
}

function openVisualCardDialog(): void {
  if (!canDrawVisual.value) {
    return;
  }
  if (!artStyles.value.some(style => style.id === selectedArtStyleId.value)) {
    selectedArtStyleId.value = artStyles.value[0]?.id ?? '';
  }
  isVisualCardDialogOpen.value = true;
}

async function generateVisualCards(options?: {
  artStyleId?: string;
  guidance?: string;
}): Promise<void> {
  if (!canDrawVisual.value) {
    if (drawDisabledReason.value) {
      toast.error(drawDisabledReason.value);
    }
    return;
  }
  const artStyleId = options?.artStyleId ?? selectedArtStyleId.value;
  if (!artStyleId) {
    return;
  }
  isVisualCardDialogOpen.value = false;
  isDrawing.value = true;
  mobilePane.value = 'chat';
  try {
    const draw = await window.desktop.generateCharacterVisualCards({
      artStyleId,
      guidance: options?.guidance,
      model: model.value,
    });
    selectedArtStyleId.value = artStyleId;
    replaceVisualDraw(draw);
    scheduleDrawPolling(draw);
    if (draw.cards.every(card => card.status === 'failed')) {
      toast.error('视觉简报已生成，但图片任务都没有提交成功');
    } else {
      toast.success('视觉卡已提交生成');
    }
  } catch (drawError: unknown) {
    toast.error(drawError instanceof Error ? drawError.message : String(drawError));
  } finally {
    isDrawing.value = false;
  }
}

function redrawVisualCards(draw: CharacterVisualCardDraw): void {
  void generateVisualCards({ artStyleId: draw.artStyle.id });
}

function refineVisualCard(payload: {
  card: CharacterVisualCard;
  draw: CharacterVisualCardDraw;
}): void {
  void generateVisualCards({
    artStyleId: payload.draw.artStyle.id,
    guidance: `保留这个视觉方向并生成三个相近但有明确差异的变体：${payload.card.summary}\n可见特征：${payload.card.tags.join('、')}`,
  });
}

function continueVisualDirection(card: CharacterVisualCard): void {
  void send(
    `我更喜欢视觉卡「${card.title}」的方向：${card.summary}。可见特征是${card.tags.join('、')}。我们继续聊这个方向，但先不要把这些外观假设写入角色档案。`,
  );
}

async function send(text: string) {
  if (!text.trim() || isInputDisabled.value || isBusy.value) {
    return;
  }
  await sendMessage({ text: text.trim() });
}

async function retry() {
  if (chatStatus.value !== 'error') {
    return;
  }
  await regenerate();
}

async function saveProfile() {
  if (!proposedProfileMarkdown.value || isSaving.value) {
    return;
  }
  isSaving.value = true;
  try {
    await window.desktop.saveCharacterProfile({
      markdown: proposedProfileMarkdown.value,
    });
    savedProfileMarkdown.value = proposedProfileMarkdown.value;
    isProfileSaved.value = true;
    toast.success('角色完成稿已保存到 ip.md');
  } catch (saveError: unknown) {
    toast.error(saveError instanceof Error ? saveError.message : String(saveError));
  } finally {
    isSaving.value = false;
  }
}

function resetConversation() {
  clearError();
  messages.value = [];
  proposedProfileMarkdown.value = '';
  isProfileSaved.value = Boolean(savedProfileMarkdown.value);
  isResetDialogOpen.value = false;
  mobilePane.value = 'chat';
}

function closeWorkspace(): void {
  workspaceOpen.value = false;
  mobilePane.value = 'chat';
}

function openWorkspace(): void {
  workspaceOpen.value = true;
  mobilePane.value = 'draft';
}

watch(messages, messageList => applyToolOutputs(messageList));
onMounted(() => {
  void initialize();
});

onBeforeUnmount(() => {
  disposed = true;
  for (const timer of pollTimers.values()) {
    clearTimeout(timer);
  }
  pollTimers.clear();
  pollingStates.value = {};
});
</script>

<template>
  <SagPage>
    <template #before-header>
      <CharacterContextBar active-section="character" />
    </template>

    <template #header>
      <CharacterChatHeader
        v-model:mobile-pane="mobilePane"
        :busy="isBusy"
        :key-configured="keyConfigured"
        :model="model"
        :workspace-open="workspaceOpen"
        @open-workspace="openWorkspace"
        @new-session="isResetDialogOpen = true"
      />
    </template>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>Agent 暂时无法继续</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button v-if="chatStatus === 'error'" variant="outline" size="sm" @click="retry">
          重试
        </Button>
      </AlertDescription>
    </Alert>

    <div
      :class="[
        'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden',
        workspaceOpen && 'lg:grid-cols-[minmax(0,3fr)_minmax(320px,2fr)]',
      ]"
    >
      <section
        :class="[
          'min-h-0 min-w-0 flex-col overflow-hidden lg:flex',
          !workspaceOpen || mobilePane === 'chat' ? 'flex' : 'hidden',
        ]"
        aria-label="角色共创对话"
      >
        <CharacterChatMessages
          :busy="isBusy || isDrawing"
          :messages="messages"
          :polling-states="pollingStates"
          :preparing-visual="isDrawing"
          :status="chatStatus"
          :visual-draws="visualDraws"
          @continue-visual="continueVisualDirection"
          @redraw-visual="redrawVisualCards"
          @refine-visual="refineVisualCard"
          @suggest="send"
        />
        <CharacterChatInput
          :disabled="isInputDisabled"
          :draw-busy="isDrawing"
          :draw-disabled="!canDrawVisual"
          :draw-disabled-reason="drawDisabledReason"
          :status="chatStatus"
          @draw="openVisualCardDialog"
          @send="send"
          @stop="stop"
        />
      </section>

      <aside
        v-if="workspaceOpen"
        :class="[
          'min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5',
          mobilePane === 'draft' ? 'flex' : 'hidden',
        ]"
        aria-label="角色档案"
      >
        <CharacterWorkspacePanel
          :can-draw-visual="canDrawVisual"
          :can-save="Boolean(proposedProfileMarkdown) && !isProfileSaved"
          :draw-busy="isDrawing"
          :draw-disabled-reason="drawDisabledReason"
          :draft="draft"
          :is-saving="isSaving"
          :profile-markdown="profileMarkdown"
          :saved="isProfileSaved"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeWorkspace"
          @draw-visual="openVisualCardDialog"
          @save="saveProfile"
        />
      </aside>
    </div>

    <Dialog v-model:open="isResetDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>开始新对话？</DialogTitle>
          <DialogDescription>
            当前消息会被清空，已经整理到角色草稿和保存到 ip.md 的内容会保留。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="isResetDialogOpen = false">取消</Button>
          <Button @click="resetConversation">开始新对话</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CharacterVisualCardDialog
      v-model:open="isVisualCardDialogOpen"
      v-model:selected-art-style-id="selectedArtStyleId"
      :art-styles="artStyles"
      :busy="isDrawing"
      @generate="generateVisualCards()"
    />
  </SagPage>
</template>
