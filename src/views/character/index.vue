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
import { CharacterAssetUploadDialog } from '@/components/sag/character-asset-upload-dialog';
import { SagPage } from '@/components/sag/sag-page';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import CharacterContextBar from '@/components/sag/character-context-bar.vue';
import type {
  CharacterAgentMessage,
  CharacterDraft,
  CharacterDraftUpdateResult,
  CharacterVisualCard,
  CharacterVisualCardDraw,
  CredentialStatus,
  SavedFileResult,
  UploadCharacterVisualAssetRequest,
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
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input';

const appStore = useAppStore();
const draft = ref<CharacterDraft>(createEmptyCharacterDraft());
const visualDraws = ref<CharacterVisualCardDraw[]>([]);
const pollingStates = ref<GenerationPollingStateMap>({});
const credentialStatus = ref<CredentialStatus | null>(null);
const imageCredentialStatus = ref<CredentialStatus | null>(null);
const initializationError = ref('');
const isInitializing = ref(true);
const isDrawing = ref(false);
const isVisualCardDialogOpen = ref(false);
const adjustmentCard = ref<CharacterVisualCard | null>(null);
const adjustmentMessages = ref<string[]>([]);
const savingCardIds = ref<string[]>([]);
const isResetDialogOpen = ref(false);
const uploadDialogOpen = ref(false);
const workspaceOpen = ref(true);
const mobilePane = ref<'chat' | 'draft'>('chat');
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
let disposed = false;

const model = computed(() => appStore.settings.deepseekModel.trim() || DEFAULT_DEEPSEEK_MODEL);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const imageKeyConfigured = computed(() => Boolean(imageCredentialStatus.value?.configured));
const hasCharacterSeed = computed(() =>
  [
    draft.value.characterSeed,
    draft.value.visualSummary,
    draft.value.ageAndBuild,
    draft.value.faceAnchor,
    draft.value.visualMedium,
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
  if (!hasCharacterSeed.value) {
    return '先聊出人物种子或一个明确的形象方向';
  }
  if (adjustmentCard.value && adjustmentMessages.value.length === 0) {
    return '先在对话中说明下一张需要保留什么、调整什么';
  }
  return '';
});
const canDrawVisual = computed(() => !drawDisabledReason.value);

function isDraftUpdateResult(value: unknown): value is CharacterDraftUpdateResult {
  return Boolean(value && typeof value === 'object' && 'draft' in value);
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
    }
  }
}

async function refreshWorkspace() {
  const workspace = await window.desktop.getCharacterWorkspace();
  draft.value = workspace.draft;
}

async function initialize() {
  isInitializing.value = true;
  initializationError.value = '';
  try {
    const [workspace, statusResult, imageStatusResult, visualCardWorkspace] = await Promise.all([
      window.desktop.getCharacterWorkspace(),
      window.desktop.getCredentialStatus('deepseek'),
      window.desktop.getCredentialStatus('apimart'),
      window.desktop.getCharacterVisualCardWorkspace(),
    ]);
    draft.value = workspace.draft;
    credentialStatus.value = statusResult;
    imageCredentialStatus.value = imageStatusResult;
    visualDraws.value = visualCardWorkspace.draws;
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
  isVisualCardDialogOpen.value = true;
}

function uploadVisualAsset(request: UploadCharacterVisualAssetRequest): Promise<SavedFileResult> {
  return window.desktop.uploadCharacterVisualAsset(request);
}

function handleVisualUploaded(): void {
  toast.success('角色形象已保存到角色视觉');
}

async function generateVisualCards(options?: { guidance?: string }): Promise<boolean> {
  if (!canDrawVisual.value) {
    if (drawDisabledReason.value) {
      toast.error(drawDisabledReason.value);
    }
    return false;
  }
  isVisualCardDialogOpen.value = false;
  isDrawing.value = true;
  mobilePane.value = 'chat';
  try {
    const draw = await window.desktop.generateCharacterVisualCards({
      guidance: options?.guidance,
      model: model.value,
    });
    replaceVisualDraw(draw);
    scheduleDrawPolling(draw);
    if (draw.cards.every(card => card.status === 'failed')) {
      toast.error('视觉简报已生成，但图片任务都没有提交成功');
    } else {
      toast.success('视觉卡已提交生成');
    }
    return true;
  } catch (drawError: unknown) {
    toast.error(drawError instanceof Error ? drawError.message : String(drawError));
    return false;
  } finally {
    isDrawing.value = false;
  }
}

async function saveVisualCard(payload: {
  card: CharacterVisualCard;
  draw: CharacterVisualCardDraw;
}): Promise<void> {
  if (payload.card.savedToVisualAt || savingCardIds.value.includes(payload.card.id)) {
    return;
  }
  savingCardIds.value = [...savingCardIds.value, payload.card.id];
  try {
    const draw = await window.desktop.saveCharacterVisualCard({
      cardId: payload.card.id,
      drawId: payload.draw.id,
    });
    replaceVisualDraw(draw);
    toast.success('视觉卡已保存到角色视觉');
  } catch (saveError: unknown) {
    toast.error(saveError instanceof Error ? saveError.message : String(saveError));
  } finally {
    savingCardIds.value = savingCardIds.value.filter(cardId => cardId !== payload.card.id);
  }
}

function adjustVisualDirection(card: CharacterVisualCard): void {
  if (!canDrawVisual.value) {
    toast.error(drawDisabledReason.value);
    return;
  }
  adjustmentCard.value = card;
  adjustmentMessages.value = [];
  mobilePane.value = 'chat';
  void send(
    `我想继续调整视觉卡「${card.title}」。当前方向是：${card.summary}。可见特征包括：${card.tags.join('、')}。请先问我下一张需要保留什么、调整什么；这张卡里的视觉假设先不要写入角色档案。`,
    false,
  );
}

async function generateFromDialog(): Promise<void> {
  const card = adjustmentCard.value;
  const userGuidance = adjustmentMessages.value.join('\n').slice(-1_200);
  const generated = await generateVisualCards({
    guidance: card
      ? `以上一张视觉卡为基础继续调整。上一张方向：${card.summary}\n可见特征：${card.tags.join('、')}\n用户在对话中提出的调整要求：${userGuidance}`
      : undefined,
  });
  if (generated) {
    adjustmentCard.value = null;
    adjustmentMessages.value = [];
  }
}

async function send(message: string | PromptInputMessage, captureAdjustment = true) {
  const text = typeof message === 'string' ? message.trim() : message.text.trim();
  const files = typeof message === 'string' ? [] : message.files;
  if ((!text && files.length === 0) || isInputDisabled.value || isBusy.value) {
    return;
  }
  if (captureAdjustment && adjustmentCard.value && text) {
    adjustmentMessages.value = [...adjustmentMessages.value, text];
  }
  await sendMessage({ files, text });
}

async function retry() {
  if (chatStatus.value !== 'error') {
    return;
  }
  await regenerate();
}

function resetConversation() {
  clearError();
  messages.value = [];
  adjustmentCard.value = null;
  adjustmentMessages.value = [];
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
      <CharacterContextBar />
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
          :messages="messages"
          :status="chatStatus"
          @suggest="send"
          @upload-visual="uploadDialogOpen = true"
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
          :draw-busy="isDrawing"
          :draw-disabled-reason="drawDisabledReason"
          :draft="draft"
          :polling-states="pollingStates"
          :saving-card-ids="savingCardIds"
          :visual-draws="visualDraws"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeWorkspace"
          @adjust-visual="adjustVisualDirection"
          @draw-visual="openVisualCardDialog"
          @save-visual="saveVisualCard"
        />
      </aside>
    </div>

    <CharacterAssetUploadDialog
      v-model:open="uploadDialogOpen"
      title="直接上传角色形象"
      description="图片会保存到当前角色的角色视觉库，可在角色视觉中继续管理。"
      :upload-handler="uploadVisualAsset"
      @uploaded="handleVisualUploaded"
    />

    <Dialog v-model:open="isResetDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>开始新对话？</DialogTitle>
          <DialogDescription>
            当前消息会被清空，已经整理到结构化草稿的内容和抽卡结果会保留。
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
      :adjustment-card="adjustmentCard"
      :busy="isDrawing"
      @generate="generateFromDialog"
    />
  </SagPage>
</template>
