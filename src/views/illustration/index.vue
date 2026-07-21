<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { toast } from 'vue-sonner';
import {
  ImageReferencePickerDialog,
  type ImageReferencePickerFilter,
  type ImageReferencePickerOption,
} from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import SagErrorRetryAlert from '@/components/sag/sag-error-retry-alert.vue';
import { SagPage } from '@/components/sag/sag-page';
import { useCredentialStatus } from '@/composables/use-credential-status';
import { useGenerationPolling } from '@/composables/use-generation-polling';
import { useAppStore } from '@/stores/app';
import type {
  CharacterPortraitResolution,
  CharacterExpressionReferenceSelection,
  CharacterExpressionWorkspaceState,
  CharacterPortraitWorkspaceState,
  CharacterVisualAssetSelection,
  IllustrationAgentMessage,
  IllustrationBriefUpdateResult,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
  UploadedIllustration,
} from '@/types';
import { ILLUSTRATION_AGENT_ENDPOINT, MAX_ILLUSTRATION_REFERENCE_IMAGES } from '@/types';
import { cloneJsonData } from '@/utils/serialization';
import IllustrationChatInput from './components/illustration-chat-input.vue';
import IllustrationChatMessages from './components/illustration-chat-messages.vue';
import IllustrationHeader from './components/illustration-header.vue';
import IllustrationRevisionDialog from './components/illustration-revision-dialog.vue';
import IllustrationWorkspacePanel from './components/illustration-workspace-panel.vue';

interface IllustrationCharacterReferenceOption extends ImageReferencePickerOption {
  selection: CharacterExpressionReferenceSelection;
}

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
const topics = ref<IllustrationTopic[]>([]);
const uploads = ref<UploadedIllustration[]>([]);
const activeTopicId = ref('');
const portraitWorkspace = ref<CharacterPortraitWorkspaceState | null>(null);
const expressionWorkspace = ref<CharacterExpressionWorkspaceState | null>(null);
const initializationError = ref('');
const generationError = ref('');
const isInitializing = ref(true);
const isGenerating = ref(false);
const isDeleting = ref(false);
const deleteTopicDialogOpen = ref(false);
const deleteVersionTarget = ref<IllustrationVersion | null>(null);
const referenceDialogOpen = ref(false);
const mobilePane = ref<'chat' | 'workspace'>('chat');
const prompt = ref('');
const size = ref<IllustrationSize>('16:9');
const resolution = ref<CharacterPortraitResolution>('1k');
const selectedCharacterReferences = ref<CharacterExpressionReferenceSelection[]>([]);
const revisionTarget = ref<IllustrationVersion | null>(null);

const {
  apimartConfigured,
  deepseekConfigured,
  refresh: refreshCredentialStatus,
} = useCredentialStatus();

const { pollingStates, schedulePoll } = useGenerationPolling<IllustrationVersion>({
  fetchTask: id => window.desktop.illustration.getIllustrationTask(id),
  isStillRunning: v =>
    ['submitted', 'pending', 'processing'].includes(v.status),
  isTerminalSuccess: v => v.status === 'completed',
  onPollSuccess: (_id, version) => {
    replaceVersion(version);
    generationError.value = '';
  },
  onCompleted: (_id, version) => {
    toast.success(`V${version.versionNumber} 已生成并保存到工作区`);
    mobilePane.value = 'workspace';
  },
  onFailed: (_id, version) => {
    generationError.value = version.errorMessage || '插画生成任务未完成';
  },
  onError: (_id, err) => {
    generationError.value = err instanceof Error ? err.message : String(err);
  },
});

const model = computed(() => appStore.settings.deepseekModel);
const activeTopic = computed(
  () => topics.value.find(topic => topic.id === activeTopicId.value) ?? null,
);
const referenceFilters: ImageReferencePickerFilter[] = [
  { label: '视觉资产', value: 'visual' },
  { label: '已有表情', value: 'expression' },
];
const characterReferenceOptions = computed<IllustrationCharacterReferenceOption[]>(() => {
  const visualOptions = (portraitWorkspace.value?.officialAssets ?? []).flatMap(selection => {
    const match = findOfficialVisual(selection);
    if (!match) {
      return [];
    }
    return [
      {
        detail: selection.kind === 'portrait' ? `角色图片 · ${match.record.size}` : '角色表 · 16:9',
        image: match.image,
        key: characterReferenceKey(selection),
        label: match.image.name || match.record.name || '正式角色视觉',
        selection,
        source: 'visual',
      },
    ];
  });
  const expressionOptions = (expressionWorkspace.value?.records ?? []).flatMap(record =>
    record.status === 'completed'
      ? record.images.map((image, index) => {
          const selection = {
            fileName: image.fileName,
            kind: 'expression' as const,
            taskId: record.id,
          };
          return {
            detail: record.source === 'uploaded' ? '已有表情 · 上传' : '已有表情 · 生成',
            image,
            key: characterReferenceKey(selection),
            label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
            selection,
            source: 'expression',
          };
        })
      : [],
  );
  return [...visualOptions, ...expressionOptions];
});
const selectedCharacterReferenceKeys = computed(() =>
  selectedCharacterReferences.value.map(characterReferenceKey),
);
const selectedCharacterReferenceOptions = computed(() => {
  const selectedKeySet = new Set(selectedCharacterReferenceKeys.value);
  return characterReferenceOptions.value.filter(option => selectedKeySet.has(option.key));
});
const characterReferencePreviews = computed(() =>
  selectedCharacterReferenceOptions.value.map(option => ({
    image: option.image,
    label: option.label,
  })),
);
const referencesReady = computed(() => selectedCharacterReferenceOptions.value.length > 0);
const maxCharacterReferenceCount = computed(() => MAX_ILLUSTRATION_REFERENCE_IMAGES);

function characterReferenceKey(selection: CharacterExpressionReferenceSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

function findOfficialVisual(selection: CharacterVisualAssetSelection) {
  const workspace = portraitWorkspace.value;
  if (!workspace) {
    return null;
  }
  const records = selection.kind === 'sheet' ? workspace.sheetRecords : workspace.records;
  const record = records.find(record => record.id === selection.taskId);
  const image = record?.images.find(image => image.fileName === selection.fileName);
  return record && image ? { image, record } : null;
}

function selectCharacterReferenceKeys(keys: string[]): void {
  const selectedKeySet = new Set(keys);
  selectedCharacterReferences.value = characterReferenceOptions.value
    .filter(option => selectedKeySet.has(option.key))
    .slice(0, maxCharacterReferenceCount.value)
    .map(option => ({ ...option.selection }));
}

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

function applyTopic(topic: IllustrationTopic): void {
  activeTopicId.value = topic.id;
  messages.value = topic.messages;
  prompt.value = topic.brief.finalPrompt;
  const latestVersion = topic.versions[0];
  size.value = latestVersion?.size ?? '16:9';
  resolution.value = latestVersion?.resolution ?? '1k';
  const availableReferenceKeys = new Set(characterReferenceOptions.value.map(option => option.key));
  selectedCharacterReferences.value = (latestVersion?.characterReferences ?? [])
    .filter(reference => availableReferenceKeys.has(characterReferenceKey(reference)))
    .slice(0, maxCharacterReferenceCount.value)
    .map(reference => ({ ...reference }));
  clearError();
  generationError.value = '';
  mobilePane.value = 'chat';
}

function openRequestedRevision(topic: IllustrationTopic): void {
  const requestedTopicId = route.query.revisionTopicId;
  const requestedVersionId = route.query.revisionVersionId;
  if (
    typeof requestedTopicId !== 'string' ||
    typeof requestedVersionId !== 'string' ||
    requestedTopicId !== topic.id
  ) {
    return;
  }
  const version = topic.versions.find(
    item => item.id === requestedVersionId && item.status === 'completed' && item.images.length,
  );
  if (!version) {
    return;
  }
  revisionTarget.value = version;
  const {
    revisionTopicId: _revisionTopicId,
    revisionVersionId: _revisionVersionId,
    ...query
  } = route.query;
  void router.replace({ query });
}

async function initialize(): Promise<void> {
  isInitializing.value = true;
  initializationError.value = '';
  try {
    const [workspace, portraits, library] = await Promise.all([
      window.desktop.illustration.getIllustrationWorkspace(),
      window.desktop.character.portrait.getCharacterPortraitWorkspace(),
      window.desktop.character.library.getCharacterLibrary(),
      refreshCredentialStatus(),
    ]);
    const expressions = await window.desktop.character.expression.getCharacterExpressionWorkspace({
      characterId: library.activeCharacterId,
    });
    topics.value = workspace.topics;
    uploads.value = workspace.uploads;
    portraitWorkspace.value = portraits;
    expressionWorkspace.value = expressions;

    const requestedTopicId = route.query.revisionTopicId;
    let topic =
      typeof requestedTopicId === 'string'
        ? topics.value.find(item => item.id === requestedTopicId)
        : undefined;
    topic ??= topics.value[0];
    if (!topic) {
      topic = await window.desktop.illustration.createIllustrationTopic({ useCharacter: true });
      topics.value = [topic];
    }
    applyTopic(topic);
    openRequestedRevision(topic);
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
    const updatedTopic = await window.desktop.illustration.saveIllustrationConversation({
      messages: cloneJsonData(messages.value),
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
    const topic = await window.desktop.illustration.createIllustrationTopic({ useCharacter: true });
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
      await window.desktop.illustration.updateIllustrationTopic({
        topicId: topic.id,
        useCharacter: value,
      }),
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
    replaceTopic(
      await window.desktop.illustration.updateIllustrationTopic({ title, topicId: topic.id }),
    );
  } catch (renameError: unknown) {
    toast.error(renameError instanceof Error ? renameError.message : String(renameError));
  }
}

interface GenerateIllustrationOptions {
  baseVersion: IllustrationVersionReference | null;
  revisionPrompt: string | null;
}

async function generate(
  options: GenerateIllustrationOptions = { baseVersion: null, revisionPrompt: null },
): Promise<boolean> {
  const topic = activeTopic.value;
  if (!topic || generationBusy.value || !prompt.value.trim()) {
    return false;
  }
  isGenerating.value = true;
  generationError.value = '';
  try {
    const maxReferences = Math.max(
      0,
      MAX_ILLUSTRATION_REFERENCE_IMAGES - Number(Boolean(options.baseVersion)),
    );
    const characterReferences = topic.useCharacter
      ? selectedCharacterReferences.value
          .slice(0, maxReferences)
          .map(reference => ({ ...reference }))
      : [];
    if (characterReferences.length < selectedCharacterReferences.value.length) {
      toast.info('修改版本会额外使用原插画，已将总参考图控制在 16 张以内');
    }
    const version = await window.desktop.illustration.generateIllustration({
      baseVersion: options.baseVersion,
      characterReferences,
      prompt: prompt.value.trim(),
      revisionPrompt: options.revisionPrompt,
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
    return true;
  } catch (generateError: unknown) {
    generationError.value =
      generateError instanceof Error ? generateError.message : String(generateError);
    return false;
  } finally {
    isGenerating.value = false;
  }
}

function openRevisionDialog(version: IllustrationVersion): void {
  revisionTarget.value = version;
}

function updateRevisionDialogOpen(open: boolean): void {
  if (!open && !generationBusy.value) {
    revisionTarget.value = null;
  }
}

async function confirmRevision(revisionPrompt: string): Promise<void> {
  const version = revisionTarget.value;
  const image = version?.images[0];
  if (!version || !image) {
    return;
  }
  const generated = await generate({
    baseVersion: { fileName: image.fileName, versionId: version.id },
    revisionPrompt,
  });
  if (generated) {
    revisionTarget.value = null;
  }
}

async function confirmDeleteTopic(): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    const workspace = await window.desktop.illustration.deleteIllustrationTopic({
      topicId: topic.id,
    });
    topics.value = workspace.topics;
    deleteTopicDialogOpen.value = false;
    let nextTopic = topics.value[0];
    if (!nextTopic) {
      nextTopic = await window.desktop.illustration.createIllustrationTopic({ useCharacter: true });
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
    const updatedTopic = await window.desktop.illustration.deleteIllustrationVersion({
      topicId: topic.id,
      versionId: version.id,
    });
    replaceTopic(updatedTopic);
    if (revisionTarget.value?.id === version.id) {
      revisionTarget.value = null;
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

    <SagErrorRetryAlert
      v-if="errorMessage"
      class="mx-4 mt-3 shrink-0 sm:mx-5"
      title="插画创作暂时无法继续"
      :error-message="errorMessage"
      retry-label="重试"
      :can-retry="chatStatus === 'error'"
      @retry="retry"
    />

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
          :busy="generationBusy"
          :prompt="prompt"
          :polling-states="pollingStates"
          :character-references="characterReferencePreviews"
          :references-ready="referencesReady"
          :resolution="resolution"
          :size="size"
          :topic="activeTopic"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @delete-version="deleteVersionTarget = $event"
          @generate="generate"
          @open-reference-picker="referenceDialogOpen = true"
          @rename="renameTopic"
          @revise="openRevisionDialog"
          @update:prompt="prompt = $event"
          @update:resolution="resolution = $event"
          @update:size="size = $event"
          @update:use-character="updateUseCharacter"
        />
      </aside>
    </div>

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="generationBusy"
      description="可以混选当前角色的正式视觉资产和已有表情，生成时只使用这里确认的图片。"
      empty-description="当前角色还没有可选择的正式视觉资产或已有表情。"
      :filters="referenceFilters"
      :max-selection="maxCharacterReferenceCount"
      :options="characterReferenceOptions"
      :selected-keys="selectedCharacterReferenceKeys"
      title="选择角色参考"
      @confirm="selectCharacterReferenceKeys"
    />

    <IllustrationRevisionDialog
      :busy="generationBusy"
      :open="Boolean(revisionTarget)"
      :version="revisionTarget"
      @confirm="confirmRevision"
      @update:open="updateRevisionDialogOpen"
    />

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
