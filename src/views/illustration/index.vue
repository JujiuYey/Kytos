<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { AlertCircle } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import { useAppStore } from '@/stores/app';
import type {
  CharacterPortraitResolution,
  CharacterPortraitWorkspaceState,
  CredentialStatus,
  IllustrationAgentMessage,
  IllustrationBriefUpdateResult,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
} from '@/types';
import { DEFAULT_DEEPSEEK_MODEL, ILLUSTRATION_AGENT_ENDPOINT } from '@/types';
import IllustrationChatInput from './components/illustration-chat-input.vue';
import IllustrationChatMessages from './components/illustration-chat-messages.vue';
import IllustrationHeader from './components/illustration-header.vue';
import IllustrationWorkspacePanel from './components/illustration-workspace-panel.vue';

const appStore = useAppStore();
const topics = ref<IllustrationTopic[]>([]);
const activeTopicId = ref('');
const deepseekStatus = ref<CredentialStatus | null>(null);
const apimartStatus = ref<CredentialStatus | null>(null);
const portraitWorkspace = ref<CharacterPortraitWorkspaceState | null>(null);
const initializationError = ref('');
const generationError = ref('');
const isInitializing = ref(true);
const isGenerating = ref(false);
const isDeleting = ref(false);
const deleteTopicDialogOpen = ref(false);
const deleteVersionTarget = ref<IllustrationVersion | null>(null);
const mobilePane = ref<'chat' | 'workspace'>('chat');
const prompt = ref('');
const size = ref<IllustrationSize>('16:9');
const resolution = ref<CharacterPortraitResolution>('2k');
const baseReference = ref<IllustrationVersionReference | null>(null);
const pollTimers = new Map<string, ReturnType<typeof setTimeout>>();
let disposed = false;

const model = computed(() => appStore.settings.deepseekModel.trim() || DEFAULT_DEEPSEEK_MODEL);
const activeTopic = computed(
  () => topics.value.find(topic => topic.id === activeTopicId.value) ?? null,
);
const deepseekConfigured = computed(() => Boolean(deepseekStatus.value?.configured));
const apimartConfigured = computed(() => Boolean(apimartStatus.value?.configured));
const referencesReady = computed(
  () =>
    Boolean(portraitWorkspace.value?.selectedImage) &&
    Boolean(portraitWorkspace.value?.selectedSheet),
);

const transport = new DefaultChatTransport<IllustrationAgentMessage>({
  api: ILLUSTRATION_AGENT_ENDPOINT,
});

const { clearError, error, messages, regenerate, sendMessage, status, stop } =
  useChat<IllustrationAgentMessage>({
    transport,
    onFinish: () => {
      void persistFinishedConversation();
    },
  });

const chatStatus = computed<ChatStatus>(() => status.value);
const chatBusy = computed(
  () => chatStatus.value === 'submitted' || chatStatus.value === 'streaming',
);
const activeGeneration = computed(() =>
  activeTopic.value?.versions.find(version =>
    ['submitted', 'pending', 'processing'].includes(version.status),
  ),
);
const generationBusy = computed(() => isGenerating.value || Boolean(activeGeneration.value));
const busy = computed(() => chatBusy.value || generationBusy.value || isDeleting.value);
const navigationBusy = computed(() => chatBusy.value || isDeleting.value);
const inputDisabled = computed(
  () =>
    isInitializing.value ||
    !activeTopic.value ||
    !deepseekConfigured.value ||
    chatStatus.value === 'error',
);
const errorMessage = computed(
  () => initializationError.value || generationError.value || error.value?.message || '',
);

function isBriefResult(value: unknown): value is IllustrationBriefUpdateResult {
  return Boolean(
    value && typeof value === 'object' && 'brief' in value && 'ready' in value && 'title' in value,
  );
}

function replaceTopic(updatedTopic: IllustrationTopic): void {
  topics.value = [updatedTopic, ...topics.value.filter(topic => topic.id !== updatedTopic.id)].sort(
    (left, right) => right.updatedAt.localeCompare(left.updatedAt),
  );
}

function replaceVersion(updatedVersion: IllustrationVersion): void {
  const topic = topics.value.find(item =>
    item.versions.some(version => version.id === updatedVersion.id),
  );
  if (!topic) {
    return;
  }
  replaceTopic({
    ...topic,
    updatedAt: updatedVersion.updatedAt,
    versions: topic.versions.map(version =>
      version.id === updatedVersion.id ? updatedVersion : version,
    ),
  });
}

function applyToolOutputs(messageList: IllustrationAgentMessage[]): void {
  const topic = activeTopic.value;
  if (!topic) {
    return;
  }
  let nextTopic = topic;
  for (const message of messageList) {
    for (const part of message.parts) {
      if (
        (part.type === 'tool-updateIllustrationBrief' ||
          part.type === 'tool-presentIllustrationPlan') &&
        part.state === 'output-available' &&
        isBriefResult(part.output)
      ) {
        nextTopic = {
          ...nextTopic,
          brief: part.output.brief,
          ready: part.output.ready,
          title: part.output.title,
        };
        prompt.value = part.output.brief.finalPrompt;
        if (part.output.ready) {
          mobilePane.value = 'workspace';
        }
      }
    }
  }
  if (nextTopic !== topic) {
    replaceTopic(nextTopic);
  }
}

function getDefaultBaseReference(topic: IllustrationTopic): IllustrationVersionReference | null {
  const version = topic.versions.find(item => item.status === 'completed' && item.images.length);
  const image = version?.images[0];
  return version && image ? { fileName: image.fileName, versionId: version.id } : null;
}

function applyTopic(topic: IllustrationTopic): void {
  activeTopicId.value = topic.id;
  messages.value = topic.messages;
  prompt.value = topic.brief.finalPrompt;
  const latestVersion = topic.versions[0];
  size.value = latestVersion?.size ?? '16:9';
  resolution.value = latestVersion?.resolution ?? '2k';
  baseReference.value = getDefaultBaseReference(topic);
  clearError();
  generationError.value = '';
  mobilePane.value = 'chat';
}

async function initialize(): Promise<void> {
  isInitializing.value = true;
  initializationError.value = '';
  try {
    const [workspace, deepseek, apimart, portraits] = await Promise.all([
      window.desktop.getIllustrationWorkspace(),
      window.desktop.getCredentialStatus('deepseek'),
      window.desktop.getCredentialStatus('apimart'),
      window.desktop.getCharacterPortraitWorkspace(),
    ]);
    topics.value = workspace.topics;
    deepseekStatus.value = deepseek;
    apimartStatus.value = apimart;
    portraitWorkspace.value = portraits;

    let topic = topics.value[0];
    if (!topic) {
      topic = await window.desktop.createIllustrationTopic({ useCharacter: true });
      topics.value = [topic];
    }
    applyTopic(topic);
    for (const item of topics.value) {
      for (const version of item.versions) {
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
  await nextTick();
  const topicId = activeTopicId.value;
  if (!topicId) {
    return;
  }
  try {
    const updatedTopic = await window.desktop.saveIllustrationConversation({
      messages: messages.value,
      topicId,
    });
    replaceTopic(updatedTopic);
  } catch (saveError: unknown) {
    toast.error(saveError instanceof Error ? saveError.message : String(saveError));
  }
}

async function send(text: string): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || !text.trim() || inputDisabled.value || chatBusy.value) {
    return;
  }
  await sendMessage({ text: text.trim() }, { body: { model: model.value, topicId: topic.id } });
}

async function retry(): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || chatStatus.value !== 'error') {
    return;
  }
  await regenerate({ body: { model: model.value, topicId: topic.id } });
}

async function createTopic(): Promise<void> {
  if (navigationBusy.value) {
    return;
  }
  try {
    const topic = await window.desktop.createIllustrationTopic({ useCharacter: true });
    replaceTopic(topic);
    applyTopic(topic);
  } catch (createError: unknown) {
    toast.error(createError instanceof Error ? createError.message : String(createError));
  }
}

function selectTopic(topicId: string): void {
  const topic = topics.value.find(item => item.id === topicId);
  if (!topic || navigationBusy.value) {
    return;
  }
  applyTopic(topic);
}

async function updateUseCharacter(value: boolean): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || busy.value) {
    return;
  }
  try {
    replaceTopic(
      await window.desktop.updateIllustrationTopic({ topicId: topic.id, useCharacter: value }),
    );
  } catch (updateError: unknown) {
    toast.error(updateError instanceof Error ? updateError.message : String(updateError));
  }
}

async function renameTopic(title: string): Promise<void> {
  const topic = activeTopic.value;
  if (!topic) {
    return;
  }
  try {
    replaceTopic(await window.desktop.updateIllustrationTopic({ title, topicId: topic.id }));
  } catch (renameError: unknown) {
    toast.error(renameError instanceof Error ? renameError.message : String(renameError));
  }
}

function schedulePoll(taskId: string): void {
  const currentTimer = pollTimers.get(taskId);
  if (currentTimer) {
    clearTimeout(currentTimer);
  }
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
  try {
    const version = await window.desktop.getIllustrationTask(taskId);
    replaceVersion(version);
    generationError.value = '';
    if (['submitted', 'pending', 'processing'].includes(version.status)) {
      schedulePoll(taskId);
      return;
    }
    pollTimers.delete(taskId);
    if (version.status === 'completed') {
      const image = version.images[0];
      if (image && activeTopic.value?.versions.some(item => item.id === version.id)) {
        baseReference.value = { fileName: image.fileName, versionId: version.id };
      }
      toast.success(`V${version.versionNumber} 已生成并保存到工作区`);
      mobilePane.value = 'workspace';
    } else {
      generationError.value = version.errorMessage || '插画生成任务未完成';
    }
  } catch (pollError: unknown) {
    generationError.value = pollError instanceof Error ? pollError.message : String(pollError);
    pollTimers.delete(taskId);
  }
}

async function generate(): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || generationBusy.value || !prompt.value.trim()) {
    return;
  }
  isGenerating.value = true;
  generationError.value = '';
  try {
    const version = await window.desktop.generateIllustration({
      baseVersion: baseReference.value,
      prompt: prompt.value.trim(),
      resolution: resolution.value,
      size: size.value,
      topicId: topic.id,
    });
    replaceTopic({
      ...topic,
      brief: { ...topic.brief, finalPrompt: prompt.value.trim() },
      updatedAt: version.updatedAt,
      versions: [version, ...topic.versions],
    });
    mobilePane.value = 'workspace';
    schedulePoll(version.id);
  } catch (generateError: unknown) {
    generationError.value =
      generateError instanceof Error ? generateError.message : String(generateError);
  } finally {
    isGenerating.value = false;
  }
}

async function confirmDeleteTopic(): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    const workspace = await window.desktop.deleteIllustrationTopic({ topicId: topic.id });
    topics.value = workspace.topics;
    deleteTopicDialogOpen.value = false;
    let nextTopic = topics.value[0];
    if (!nextTopic) {
      nextTopic = await window.desktop.createIllustrationTopic({ useCharacter: true });
      topics.value = [nextTopic];
    }
    applyTopic(nextTopic);
  } catch (deleteError: unknown) {
    toast.error(deleteError instanceof Error ? deleteError.message : String(deleteError));
  } finally {
    isDeleting.value = false;
  }
}

async function confirmDeleteVersion(): Promise<void> {
  const topic = activeTopic.value;
  const version = deleteVersionTarget.value;
  if (!topic || !version || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    const updatedTopic = await window.desktop.deleteIllustrationVersion({
      topicId: topic.id,
      versionId: version.id,
    });
    replaceTopic(updatedTopic);
    if (baseReference.value?.versionId === version.id) {
      baseReference.value = getDefaultBaseReference(updatedTopic);
    }
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
});
</script>

<template>
  <SagPage>
    <template #header>
      <IllustrationHeader
        v-if="activeTopic"
        v-model:mobile-pane="mobilePane"
        :active-topic-id="activeTopic.id"
        :busy="navigationBusy"
        :references-ready="referencesReady"
        :topics="topics"
        :topic-locked="busy"
        :use-character="activeTopic.useCharacter"
        @create="createTopic"
        @delete="deleteTopicDialogOpen = true"
        @select="selectTopic"
        @update:use-character="updateUseCharacter"
      />
    </template>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>插画创作暂时无法继续</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button v-if="chatStatus === 'error'" variant="outline" size="sm" @click="retry">
          重试
        </Button>
      </AlertDescription>
    </Alert>

    <div
      v-if="activeTopic"
      class="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(340px,2fr)]"
    >
      <section
        :class="[
          'min-h-0 min-w-0 flex-col overflow-hidden lg:flex',
          mobilePane === 'chat' ? 'flex' : 'hidden',
        ]"
        aria-label="插画共创对话"
      >
        <IllustrationChatMessages :messages="messages" :status="chatStatus" @suggest="send" />
        <IllustrationChatInput
          :disabled="inputDisabled"
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
        <IllustrationWorkspacePanel
          :apimart-configured="apimartConfigured"
          :base-reference="baseReference"
          :busy="generationBusy"
          :prompt="prompt"
          :references-ready="referencesReady"
          :resolution="resolution"
          :size="size"
          :topic="activeTopic"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @clear-base="baseReference = null"
          @delete-version="deleteVersionTarget = $event"
          @generate="generate"
          @rename="renameTopic"
          @select-base="baseReference = $event"
          @update:prompt="prompt = $event"
          @update:resolution="resolution = $event"
          @update:size="size = $event"
          @update:use-character="updateUseCharacter"
        />
      </aside>
    </div>

    <SagConfirmDialog
      v-model:open="deleteTopicDialogOpen"
      title="删除这个插画主题？"
      description="对话、画面方案和所有生成版本都会一起删除，此操作不可恢复。"
      confirm-text="删除主题"
      :loading="isDeleting"
      @confirm="confirmDeleteTopic"
    />

    <SagConfirmDialog
      :open="Boolean(deleteVersionTarget)"
      title="删除这个插画版本？"
      description="该版本的图片会从工作区永久删除，其他版本和对话仍会保留。"
      confirm-text="删除版本"
      :loading="isDeleting"
      @update:open="value => !value && (deleteVersionTarget = null)"
      @confirm="confirmDeleteVersion"
    />
  </SagPage>
</template>
