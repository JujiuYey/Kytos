<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { toast } from 'vue-sonner';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagPage } from '@/components/sag/sag-page';
import { useAppStore } from '@/stores/app';
import type {
  CharacterPortraitResolution,
  CharacterPortraitWorkspaceState,
  CredentialStatus,
  IllustrationSize,
  StoryAgentMessage,
  StoryDraftUpdateResult,
  StoryProject,
  StoryShot,
  StoryShotContent,
  StoryShotUpdateResult,
  StoryShotVersion,
  StoryVersionReference,
  StoryboardUpdateResult,
} from '@/types';
import { STORY_AGENT_ENDPOINT } from '@/types';
import { cloneJsonData } from '@/utils/serialization';
import { getChatModelDefinition } from '@/types';
import type { FileUIPart } from 'ai';
import StoryChatInput from './components/story-chat-input.vue';
import StoryChatMessages from './components/story-chat-messages.vue';
import StoryHeader from './components/story-header.vue';
import StoryShotEditorDialog from './components/story-shot-editor-dialog.vue';
import StoryWorkspacePanel from './components/story-workspace-panel.vue';

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
const stories = ref<StoryProject[]>([]);
const activeStoryId = ref('');
const deepseekStatus = ref<CredentialStatus | null>(null);
const minimaxStatus = ref<CredentialStatus | null>(null);
const apimartStatus = ref<CredentialStatus | null>(null);
const portraitWorkspace = ref<CharacterPortraitWorkspaceState | null>(null);
const initializationError = ref('');
const operationError = ref('');
const isInitializing = ref(true);
const isMutating = ref(false);
const isDeleting = ref(false);
const isSavingConversation = ref(false);
const deleteStoryDialogOpen = ref(false);
const deleteShotTarget = ref<StoryShot | null>(null);
const deleteVersionTarget = ref<{ shot: StoryShot; version: StoryShotVersion } | null>(null);
const editorOpen = ref(false);
const editorTarget = ref<StoryShot | null>(null);
const mobilePane = ref<'chat' | 'workspace'>('chat');
const workspaceTab = ref<'story' | 'storyboard' | 'final'>('story');
const submittingShotIds = ref<string[]>([]);
const baseReferences = ref<Record<string, StoryVersionReference | null>>({});
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pollingStates = ref<GenerationPollingStateMap>({});
let disposed = false;

const model = computed(() => appStore.settings.generalModel);
const chatProvider = computed(() => getChatModelDefinition(model.value).provider);
const chatProviderConfigured = computed(() =>
  chatProvider.value === 'minimax'
    ? Boolean(minimaxStatus.value?.configured)
    : Boolean(deepseekStatus.value?.configured),
);
const supportsImageInput = computed(() => getChatModelDefinition(model.value).supportsImageInput);
const activeStory = computed(
  () => stories.value.find(story => story.id === activeStoryId.value) ?? null,
);
const apimartConfigured = computed(() => Boolean(apimartStatus.value?.configured));
const characterAssetsReady = computed(() =>
  Boolean(portraitWorkspace.value?.officialAssets.length),
);
const assetsReady = computed(() => characterAssetsReady.value);

const transport = new DefaultChatTransport<StoryAgentMessage>({
  api: STORY_AGENT_ENDPOINT,
});

const { clearError, error, messages, regenerate, sendMessage, status, stop } =
  useChat<StoryAgentMessage>({
    transport,
    onFinish: () => {
      void persistFinishedConversation();
    },
  });

const chatStatus = computed<ChatStatus>(() => status.value);
const chatBusy = computed(
  () => chatStatus.value === 'submitted' || chatStatus.value === 'streaming',
);
const hasActiveGeneration = computed(() =>
  stories.value.some(story =>
    story.shots.some(shot =>
      shot.versions.some(version =>
        ['submitted', 'pending', 'processing'].includes(version.status),
      ),
    ),
  ),
);
const navigationBusy = computed(
  () =>
    chatBusy.value ||
    hasActiveGeneration.value ||
    isMutating.value ||
    isDeleting.value ||
    isSavingConversation.value,
);
const inputDisabled = computed(
  () =>
    isInitializing.value ||
    !activeStory.value ||
    !chatProviderConfigured.value ||
    hasActiveGeneration.value ||
    isSavingConversation.value ||
    isDeleting.value ||
    chatStatus.value === 'error',
);
const errorMessage = computed(
  () => initializationError.value || operationError.value || error.value?.message || '',
);

function isDraftResult(value: unknown): value is StoryDraftUpdateResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'draft' in value &&
    'storyReady' in value &&
    'storyboardStale' in value &&
    'title' in value,
  );
}

function isStoryboardResult(value: unknown): value is StoryboardUpdateResult {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'shots' in value &&
    'storyboardReady' in value &&
    'storyboardStale' in value,
  );
}

function isShotResult(value: unknown): value is StoryShotUpdateResult {
  return Boolean(value && typeof value === 'object' && 'shot' in value);
}

function replaceStory(updatedStory: StoryProject): void {
  stories.value = [
    updatedStory,
    ...stories.value.filter(story => story.id !== updatedStory.id),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function replaceShot(updatedShot: StoryShot, storyboardReady?: boolean): void {
  const story = stories.value.find(item => item.shots.some(shot => shot.id === updatedShot.id));
  if (!story) {
    return;
  }
  replaceStory({
    ...story,
    storyboardReady: storyboardReady ?? story.storyboardReady,
    shots: story.shots.map(shot => (shot.id === updatedShot.id ? updatedShot : shot)),
  });
}

function replaceVersion(updatedVersion: StoryShotVersion): StoryShot | null {
  const story = stories.value.find(item =>
    item.shots.some(shot => shot.versions.some(version => version.id === updatedVersion.id)),
  );
  const shot = story?.shots.find(item =>
    item.versions.some(version => version.id === updatedVersion.id),
  );
  if (!story || !shot) {
    return null;
  }
  const updatedShot: StoryShot = {
    ...shot,
    selectedVersionId:
      updatedVersion.status === 'completed' && !shot.selectedVersionId
        ? updatedVersion.id
        : shot.selectedVersionId,
    versions: shot.versions.map(version =>
      version.id === updatedVersion.id ? updatedVersion : version,
    ),
  };
  replaceStory({
    ...story,
    shots: story.shots.map(item => (item.id === shot.id ? updatedShot : item)),
    updatedAt: updatedVersion.updatedAt,
  });
  return updatedShot;
}

function applyToolOutputs(messageList: StoryAgentMessage[]): void {
  const story = activeStory.value;
  if (!story) {
    return;
  }
  let nextStory = story;
  for (const message of messageList) {
    for (const part of message.parts) {
      if (
        (part.type === 'tool-updateStoryDraft' || part.type === 'tool-presentStory') &&
        part.state === 'output-available' &&
        isDraftResult(part.output)
      ) {
        nextStory = {
          ...nextStory,
          draft: part.output.draft,
          storyboardStale: part.output.storyboardStale,
          storyReady: part.output.storyReady,
          title: part.output.title,
        };
        workspaceTab.value = 'story';
        if (part.output.storyReady) {
          mobilePane.value = 'workspace';
        }
      }
      if (
        (part.type === 'tool-presentStoryboard' || part.type === 'tool-confirmStoryboard') &&
        part.state === 'output-available' &&
        isStoryboardResult(part.output)
      ) {
        nextStory = {
          ...nextStory,
          keyShotId: part.output.keyShotId,
          shots: part.output.shots,
          storyboardReady: part.output.storyboardReady,
          storyboardStale: part.output.storyboardStale,
        };
        workspaceTab.value = 'storyboard';
        mobilePane.value = 'workspace';
      }
      if (
        part.type === 'tool-updateStoryShot' &&
        part.state === 'output-available' &&
        isShotResult(part.output)
      ) {
        nextStory = {
          ...nextStory,
          storyboardReady: part.output.storyboardReady,
          shots: nextStory.shots.map(shot =>
            shot.id === part.output.shot.id ? part.output.shot : shot,
          ),
        };
        workspaceTab.value = 'storyboard';
      }
    }
  }
  if (nextStory !== story) {
    replaceStory(nextStory);
  }
}

function applyStory(story: StoryProject): void {
  activeStoryId.value = story.id;
  messages.value = story.messages;
  baseReferences.value = {};
  clearError();
  operationError.value = '';
  workspaceTab.value = story.shots.length ? 'storyboard' : 'story';
  mobilePane.value = 'chat';
}

async function initialize(): Promise<void> {
  isInitializing.value = true;
  initializationError.value = '';
  try {
    const [workspace, deepseek, minimax, apimart, portraits] = await Promise.all([
      window.desktop.story.getStoryWorkspace(),
      window.desktop.settings.getCredentialStatus('deepseek'),
      window.desktop.settings.getCredentialStatus('minimax'),
      window.desktop.settings.getCredentialStatus('apimart'),
      window.desktop.character.portrait.getCharacterPortraitWorkspace(),
    ]);
    stories.value = workspace.stories;
    deepseekStatus.value = deepseek;
    minimaxStatus.value = minimax;
    apimartStatus.value = apimart;
    portraitWorkspace.value = portraits;

    const requestedStoryId =
      typeof route.query.storyId === 'string' ? route.query.storyId : undefined;
    let story = stories.value.find(item => item.id === requestedStoryId) ?? stories.value[0];
    if (!story) {
      story = await window.desktop.story.createStory({});
      stories.value = [story];
    }
    applyStory(story);
    if (route.query.storyId !== story.id) {
      await router.replace({ query: { ...route.query, storyId: story.id } });
    }
    for (const item of stories.value) {
      for (const version of item.shots.flatMap(shot => shot.versions)) {
        if (['submitted', 'pending', 'processing'].includes(version.status)) {
          schedulePoll(version.id);
        }
      }
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

async function persistFinishedConversation(): Promise<void> {
  isSavingConversation.value = true;
  await nextTick();
  const storyId = activeStoryId.value;
  if (!storyId) {
    isSavingConversation.value = false;
    return;
  }
  try {
    replaceStory(
      await window.desktop.story.saveStoryConversation({
        messages: cloneJsonData(messages.value),
        storyId,
      }),
    );
  } catch (saveError: unknown) {
    toast.error(saveError instanceof Error ? saveError.message : String(saveError));
  } finally {
    isSavingConversation.value = false;
  }
}

async function send(input: string | { files: FileUIPart[]; text: string }): Promise<void> {
  const payload = typeof input === 'string' ? { files: [], text: input } : input;
  const story = activeStory.value;
  if (!story || !payload.text.trim() || inputDisabled.value || chatBusy.value) {
    return;
  }
  await sendMessage(
    { files: payload.files, text: payload.text.trim() },
    { body: { model: model.value, storyId: story.id } },
  );
}

async function retry(): Promise<void> {
  const story = activeStory.value;
  if (!story || chatStatus.value !== 'error') {
    return;
  }
  await regenerate({ body: { model: model.value, storyId: story.id } });
}

async function createStory(): Promise<void> {
  if (navigationBusy.value) {
    return;
  }
  try {
    const story = await window.desktop.story.createStory({});
    replaceStory(story);
    applyStory(story);
    await router.replace({ query: { ...route.query, storyId: story.id } });
  } catch (createError: unknown) {
    toast.error(createError instanceof Error ? createError.message : String(createError));
  }
}

function selectStory(storyId: string): void {
  const story = stories.value.find(item => item.id === storyId);
  if (!story || navigationBusy.value) {
    return;
  }
  applyStory(story);
  void router.replace({ query: { ...route.query, storyId: story.id } });
}

async function updateProject(
  patch: Partial<{
    confirmStoryboard: boolean;
    keyShotId: string;
    resolution: CharacterPortraitResolution;
    size: IllustrationSize;
    title: string;
  }>,
): Promise<void> {
  const story = activeStory.value;
  if (!story || isMutating.value) {
    return;
  }
  isMutating.value = true;
  try {
    replaceStory(await window.desktop.story.updateStory({ ...patch, storyId: story.id }));
  } catch (updateError: unknown) {
    toast.error(updateError instanceof Error ? updateError.message : String(updateError));
  } finally {
    isMutating.value = false;
  }
}

function openAddShot(): void {
  editorTarget.value = null;
  editorOpen.value = true;
}

function openEditShot(shot: StoryShot): void {
  editorTarget.value = shot;
  editorOpen.value = true;
}

async function saveShot(content: StoryShotContent): Promise<void> {
  const story = activeStory.value;
  if (!story || isMutating.value) {
    return;
  }
  isMutating.value = true;
  try {
    if (editorTarget.value) {
      const result = await window.desktop.story.updateStoryShot({
        ...content,
        shotId: editorTarget.value.id,
        storyId: story.id,
      });
      replaceShot(result.shot, result.storyboardReady);
    } else {
      replaceStory(await window.desktop.story.createStoryShot({ ...content, storyId: story.id }));
    }
    editorOpen.value = false;
  } catch (saveError: unknown) {
    toast.error(saveError instanceof Error ? saveError.message : String(saveError));
  } finally {
    isMutating.value = false;
  }
}

async function moveShot(payload: { direction: -1 | 1; shot: StoryShot }): Promise<void> {
  const story = activeStory.value;
  if (!story || isMutating.value) {
    return;
  }
  isMutating.value = true;
  try {
    replaceStory(
      await window.desktop.story.moveStoryShot({
        direction: payload.direction,
        shotId: payload.shot.id,
        storyId: story.id,
      }),
    );
  } catch (moveError: unknown) {
    toast.error(moveError instanceof Error ? moveError.message : String(moveError));
  } finally {
    isMutating.value = false;
  }
}

function schedulePoll(taskId: string): void {
  const currentTimer = pollTimers.get(taskId);
  if (currentTimer) {
    clearTimeout(currentTimer);
  }
  const previousState = pollingStates.value[taskId];
  pollingStates.value = {
    ...pollingStates.value,
    [taskId]: { attempt: previousState?.attempt ?? 0, phase: 'waiting' },
  };
  pollTimers.set(
    taskId,
    setTimeout(() => {
      void pollTask(taskId);
    }, 2500),
  );
}

async function pollTask(taskId: string): Promise<void> {
  if (disposed) {
    return;
  }
  const previousState = pollingStates.value[taskId];
  pollingStates.value = {
    ...pollingStates.value,
    [taskId]: { attempt: (previousState?.attempt ?? 0) + 1, phase: 'requesting' },
  };
  try {
    const version = await window.desktop.story.getStoryShotTask(taskId);
    const shot = replaceVersion(version);
    operationError.value = '';
    if (['submitted', 'pending', 'processing'].includes(version.status)) {
      schedulePoll(taskId);
      return;
    }
    pollTimers.delete(taskId);
    const nextPollingStates = { ...pollingStates.value };
    delete nextPollingStates[taskId];
    pollingStates.value = nextPollingStates;
    if (version.status === 'completed') {
      toast.success(`第 ${shot?.order ?? '-'} 镜 V${version.versionNumber} 已生成并设为正式画面`);
      workspaceTab.value = 'storyboard';
      mobilePane.value = 'workspace';
    } else {
      operationError.value = version.errorMessage || '分镜图片生成任务未完成';
    }
  } catch (pollError: unknown) {
    operationError.value = pollError instanceof Error ? pollError.message : String(pollError);
    pollTimers.delete(taskId);
    pollingStates.value = {
      ...pollingStates.value,
      [taskId]: { attempt: pollingStates.value[taskId]?.attempt ?? 1, phase: 'paused' },
    };
  }
}

async function submitShotGeneration(shot: StoryShot): Promise<void> {
  const story = activeStory.value;
  if (!story || submittingShotIds.value.includes(shot.id)) {
    return;
  }
  submittingShotIds.value = [...submittingShotIds.value, shot.id];
  operationError.value = '';
  try {
    const version = await window.desktop.story.generateStoryShot({
      baseVersion: baseReferences.value[shot.id] ?? null,
      prompt: shot.finalPrompt,
      shotId: shot.id,
      storyId: story.id,
    });
    replaceStory({
      ...story,
      shots: story.shots.map(item =>
        item.id === shot.id
          ? {
              ...item,
              finalPrompt: shot.finalPrompt,
              versions: [version, ...item.versions],
            }
          : item,
      ),
      updatedAt: version.updatedAt,
    });
    baseReferences.value = { ...baseReferences.value, [shot.id]: null };
    schedulePoll(version.id);
  } catch (generateError: unknown) {
    operationError.value =
      generateError instanceof Error ? generateError.message : String(generateError);
  } finally {
    submittingShotIds.value = submittingShotIds.value.filter(id => id !== shot.id);
  }
}

async function generateRemaining(): Promise<void> {
  const story = activeStory.value;
  if (!story) {
    return;
  }
  const shots = story.shots.filter(
    shot =>
      !shot.selectedVersionId &&
      !shot.versions.some(version =>
        ['submitted', 'pending', 'processing'].includes(version.status),
      ),
  );
  for (const shot of shots) {
    await submitShotGeneration(shot);
    if (operationError.value) {
      break;
    }
  }
}

async function selectVersion(payload: {
  shot: StoryShot;
  version: StoryShotVersion;
}): Promise<void> {
  const story = activeStory.value;
  if (!story || isMutating.value) {
    return;
  }
  isMutating.value = true;
  try {
    replaceStory(
      await window.desktop.story.selectStoryShotVersion({
        shotId: payload.shot.id,
        storyId: story.id,
        versionId: payload.version.id,
      }),
    );
    toast.success(`第 ${payload.shot.order} 镜已更新正式画面`);
  } catch (selectError: unknown) {
    toast.error(selectError instanceof Error ? selectError.message : String(selectError));
  } finally {
    isMutating.value = false;
  }
}

function setBase(payload: { reference: StoryVersionReference; shot: StoryShot }): void {
  baseReferences.value = { ...baseReferences.value, [payload.shot.id]: payload.reference };
  toast.success(
    `下一版将基于 V${payload.shot.versions.find(item => item.id === payload.reference.versionId)?.versionNumber}`,
  );
}

function manageAssets(): void {
  void router.push(characterAssetsReady.value ? '/illustration-library' : '/character-portrait');
}

async function confirmDeleteStory(): Promise<void> {
  const story = activeStory.value;
  if (!story || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    const workspace = await window.desktop.story.deleteStory({ storyId: story.id });
    stories.value = workspace.stories;
    deleteStoryDialogOpen.value = false;
    let nextStory = stories.value[0];
    if (!nextStory) {
      nextStory = await window.desktop.story.createStory({});
      stories.value = [nextStory];
    }
    applyStory(nextStory);
    await router.replace({ query: { ...route.query, storyId: nextStory.id } });
  } catch (deleteError: unknown) {
    toast.error(deleteError instanceof Error ? deleteError.message : String(deleteError));
  } finally {
    isDeleting.value = false;
  }
}

async function confirmDeleteShot(): Promise<void> {
  const story = activeStory.value;
  const shot = deleteShotTarget.value;
  if (!story || !shot || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    replaceStory(
      await window.desktop.story.deleteStoryShot({ shotId: shot.id, storyId: story.id }),
    );
    deleteShotTarget.value = null;
  } catch (deleteError: unknown) {
    toast.error(deleteError instanceof Error ? deleteError.message : String(deleteError));
  } finally {
    isDeleting.value = false;
  }
}

async function confirmDeleteVersion(): Promise<void> {
  const story = activeStory.value;
  const target = deleteVersionTarget.value;
  if (!story || !target || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    replaceStory(
      await window.desktop.story.deleteStoryShotVersion({
        shotId: target.shot.id,
        storyId: story.id,
        versionId: target.version.id,
      }),
    );
    deleteVersionTarget.value = null;
  } catch (deleteError: unknown) {
    toast.error(deleteError instanceof Error ? deleteError.message : String(deleteError));
  } finally {
    isDeleting.value = false;
  }
}

watch(messages, messageList => applyToolOutputs(messageList), { deep: true });

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
    <template #header>
      <StoryHeader
        v-if="activeStory"
        v-model:mobile-pane="mobilePane"
        :active-story-id="activeStory.id"
        :assets-ready="assetsReady"
        :busy="navigationBusy"
        :stories="stories"
        @create="createStory"
        @delete="deleteStoryDialogOpen = true"
        @manage="router.push('/stories')"
        @select="selectStory"
      />
    </template>

    <SagErrorRetryAlert
      v-if="errorMessage"
      class="mx-4 mt-3 shrink-0 sm:mx-5"
      title="故事创作暂时无法继续"
      :error-message="errorMessage"
      retry-label="重试"
      :can-retry="chatStatus === 'error'"
      @retry="retry"
    />

    <div
      v-if="activeStory"
      class="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,4fr)_minmax(440px,3fr)]"
    >
      <section
        :class="[
          'min-h-0 min-w-0 flex-col overflow-hidden lg:flex',
          mobilePane === 'chat' ? 'flex' : 'hidden',
        ]"
        aria-label="故事共创对话"
      >
        <StoryChatMessages :messages="messages" :status="chatStatus" @suggest="send" />
        <StoryChatInput
          :disabled="inputDisabled"
          :provider-name="chatProvider === 'minimax' ? 'MiniMax' : 'DeepSeek'"
          :supports-image-input="supportsImageInput"
          :status="chatStatus"
          @send="send"
          @stop="stop"
        />
      </section>

      <aside
        :class="[
          'min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5',
          mobilePane === 'workspace' ? 'flex' : 'hidden',
        ]"
      >
        <StoryWorkspacePanel
          v-model:tab="workspaceTab"
          :apimart-configured="apimartConfigured"
          :assets-ready="assetsReady"
          :busy="navigationBusy"
          :character-assets-ready="characterAssetsReady"
          :polling-states="pollingStates"
          :story="activeStory"
          :submitting-shot-ids="submittingShotIds"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @add-shot="openAddShot"
          @confirm-storyboard="updateProject({ confirmStoryboard: true })"
          @configure-service="router.push('/settings')"
          @delete-shot="deleteShotTarget = $event"
          @delete-version="deleteVersionTarget = $event"
          @edit-shot="openEditShot"
          @generate-remaining="generateRemaining"
          @generate-shot="submitShotGeneration"
          @manage-assets="manageAssets"
          @move-shot="moveShot"
          @rename="updateProject({ title: $event })"
          @select-version="selectVersion"
          @set-base="setBase"
          @set-key-shot="updateProject({ keyShotId: $event.id })"
          @update:resolution="updateProject({ resolution: $event })"
          @update:size="updateProject({ size: $event })"
        />
      </aside>
    </div>

    <StoryShotEditorDialog
      v-model:open="editorOpen"
      :busy="isMutating"
      :shot="editorTarget"
      @save="saveShot"
    />

    <SagConfirmDialog
      v-model:open="deleteStoryDialogOpen"
      title="删除这个故事？"
      description="故事对话、文字分镜和所有生成版本都会一起删除，此操作不可恢复。"
      confirm-text="删除故事"
      :loading="isDeleting"
      @confirm="confirmDeleteStory"
    />

    <SagConfirmDialog
      :open="Boolean(deleteShotTarget)"
      title="删除这个分镜？"
      description="这个分镜及其所有图片版本都会从故事中永久删除。"
      confirm-text="删除分镜"
      :loading="isDeleting"
      @update:open="value => !value && (deleteShotTarget = null)"
      @confirm="confirmDeleteShot"
    />

    <SagConfirmDialog
      :open="Boolean(deleteVersionTarget)"
      title="删除这个分镜版本？"
      description="该图片会从作品工作区永久删除，其他分镜和版本仍会保留。"
      confirm-text="删除版本"
      :loading="isDeleting"
      @update:open="value => !value && (deleteVersionTarget = null)"
      @confirm="confirmDeleteVersion"
    />
  </SagPage>
</template>
