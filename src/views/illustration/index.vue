<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus, FileUIPart } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { ImagePlus } from '@lucide/vue';
import { toast } from 'vue-sonner';
import {
  ImageReferencePickerDialog,
  type ImageReferencePickerFilter,
  type ImageReferencePickerOption,
} from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagPage } from '@/components/sag/sag-page';
import { useCredentialStatus } from '@/composables/use-credential-status';
import { useGenerationPolling } from '@/composables/use-generation-polling';
import { useAppStore } from '@/stores/app';
import type {
  CharacterLibraryCharacter,
  CharacterExpressionWorkspaceState,
  CharacterVisualResolution,
  CharacterVisualWorkspaceState,
  IllustrationAgentMessage,
  IllustrationBriefUpdateResult,
  IllustrationReference,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationVersionReference,
  UploadedIllustration,
} from '@/types';
import { ILLUSTRATION_AGENT_ENDPOINT, MAX_ILLUSTRATION_REFERENCE_IMAGES } from '@/types';
import { cloneJsonData } from '@/utils/serialization';
import { getChatModelDefinition } from '@/types';
import IllustrationChatInput from './components/illustration-chat-input.vue';
import IllustrationChatMessages from './components/illustration-chat-messages.vue';
import IllustrationHeader from './components/illustration-header.vue';
import IllustrationRevisionDialog from './components/illustration-revision-dialog.vue';
import IllustrationWorkspacePanel from './components/illustration-workspace-panel.vue';

interface IllustrationReferenceOption extends ImageReferencePickerOption {
  reference: IllustrationReference;
}

interface CharacterReferenceWorkspace {
  characterId: string;
  characterName: string;
  expression: CharacterExpressionWorkspaceState;
  visual: CharacterVisualWorkspaceState;
}

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
const topics = ref<IllustrationTopic[]>([]);
const uploads = ref<UploadedIllustration[]>([]);
const activeTopicId = ref('');
const characterReferenceWorkspaces = ref<CharacterReferenceWorkspace[]>([]);
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
const resolution = ref<CharacterVisualResolution>('1k');
const revisionTarget = ref<IllustrationVersion | null>(null);

const {
  apimartConfigured,
  deepseekConfigured,
  minimaxConfigured,
  refresh: refreshCredentialStatus,
} = useCredentialStatus();

const { pollingStates, schedulePoll } = useGenerationPolling<IllustrationVersion>({
  fetchTask: id => window.desktop.illustration.getIllustrationTask(id),
  isStillRunning: v => ['submitted', 'pending', 'processing'].includes(v.status),
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

const model = computed(() => appStore.settings.generalModel);
const chatProvider = computed(() => getChatModelDefinition(model.value).provider);
const chatProviderConfigured = computed(() =>
  chatProvider.value === 'minimax' ? minimaxConfigured.value : deepseekConfigured.value,
);
const supportsImageInput = computed(() => getChatModelDefinition(model.value).supportsImageInput);
const activeTopic = computed(
  () => topics.value.find(topic => topic.id === activeTopicId.value) ?? null,
);
const referenceFilters: ImageReferencePickerFilter[] = [
  { label: '角色视觉', value: 'character-visual' },
  { label: '角色表情', value: 'character-expression' },
  { label: '已有插画', value: 'illustration' },
];
const illustrationReferenceOptions = computed<IllustrationReferenceOption[]>(() => {
  const characterOptions = characterReferenceWorkspaces.value.flatMap(workspace => {
    const visualOptions = workspace.visual.officialAssets.flatMap(selection => {
      const record = workspace.visual.records.find(item => item.id === selection.taskId);
      const image = record?.images.find(item => item.fileName === selection.fileName);
      if (!record || !image) return [];
      const reference: IllustrationReference = {
        characterId: workspace.characterId,
        fileName: image.fileName,
        kind: 'character-visual',
        taskId: record.id,
      };
      return [
        {
          detail: `${workspace.characterName} · 正式视觉 · ${record.size}`,
          image,
          key: illustrationReferenceKey(reference),
          label: image.name || record.name || '正式角色视觉',
          reference,
          source: 'character-visual',
        },
      ];
    });
    const expressionOptions = workspace.expression.records.flatMap(record =>
      record.images.map((image, index) => {
        const reference: IllustrationReference = {
          characterId: workspace.characterId,
          fileName: image.fileName,
          kind: 'character-expression',
          taskId: record.id,
        };
        return {
          detail: `${workspace.characterName} · ${record.source === 'uploaded' ? '表情上传' : '生成表情'}`,
          image,
          key: illustrationReferenceKey(reference),
          label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
          reference,
          source: 'character-expression',
        };
      }),
    );
    return [...visualOptions, ...expressionOptions];
  });
  const uploadedOptions = uploads.value.map(upload => {
    const reference: IllustrationReference = {
      fileName: upload.fileName,
      kind: 'illustration',
      source: 'uploaded',
      topicId: null,
      uploadId: upload.id,
      versionId: null,
    };
    return {
      detail: `上传 · ${upload.originalName}`,
      image: { fileName: upload.fileName, mimeType: upload.mimeType, url: upload.url },
      key: illustrationReferenceKey(reference),
      label: upload.originalName,
      reference,
      source: 'illustration',
    };
  });
  const generatedOptions = topics.value.flatMap(topic =>
    topic.versions.flatMap(version =>
      version.status === 'completed'
        ? version.images.map(image => {
            const reference: IllustrationReference = {
              fileName: image.fileName,
              kind: 'illustration',
              source: 'generated',
              topicId: topic.id,
              uploadId: null,
              versionId: version.id,
            };
            return {
              detail: `创作 · ${topic.title} V${version.versionNumber}`,
              image,
              key: illustrationReferenceKey(reference),
              label: `${topic.title} V${version.versionNumber}`,
              reference,
              source: 'illustration',
            };
          })
        : [],
    ),
  );
  return [...characterOptions, ...uploadedOptions, ...generatedOptions];
});
const selectedReferenceKeys = computed(() =>
  (activeTopic.value?.references ?? []).map(illustrationReferenceKey),
);
const selectedReferenceOptions = computed(() => {
  const selectedKeySet = new Set(selectedReferenceKeys.value);
  return illustrationReferenceOptions.value.filter(option => selectedKeySet.has(option.key));
});
const referencePreviews = computed(() =>
  selectedReferenceOptions.value.map(option => ({
    detail: option.detail,
    image: option.image,
    key: option.key,
    label: option.label,
  })),
);
const maxReferenceCount = computed(() => MAX_ILLUSTRATION_REFERENCE_IMAGES);

function illustrationReferenceKey(reference: IllustrationReference): string {
  if (reference.kind === 'illustration') {
    return `illustration:${reference.source}:${reference.topicId ?? reference.uploadId}:${reference.versionId ?? reference.fileName}`;
  }
  return `${reference.kind}:${reference.characterId}:${reference.taskId}:${reference.fileName}`;
}

async function selectReferenceKeys(keys: string[]): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || generationBusy.value) return;
  const selectedKeySet = new Set(keys);
  const references = illustrationReferenceOptions.value
    .filter(option => selectedKeySet.has(option.key))
    .slice(0, maxReferenceCount.value)
    .map(option => ({ ...option.reference }));
  try {
    replaceTopic(
      await window.desktop.illustration.updateIllustrationTopic({
        references,
        topicId: topic.id,
      }),
    );
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  }
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
    !chatProviderConfigured.value ||
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
  clearError();
  generationError.value = '';
  mobilePane.value = 'chat';
}

async function loadCharacterReferenceWorkspaces(
  characters: CharacterLibraryCharacter[],
): Promise<void> {
  characterReferenceWorkspaces.value = await Promise.all(
    characters.map(async character => {
      const [visual, expression] = await Promise.all([
        window.desktop.character.assets.getCharacterVisualWorkspace({ characterId: character.id }),
        window.desktop.character.expression.getCharacterExpressionWorkspace({
          characterId: character.id,
        }),
      ]);
      return {
        characterId: character.id,
        characterName: character.name,
        expression,
        visual,
      };
    }),
  );
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
    const [workspace, library] = await Promise.all([
      window.desktop.illustration.getIllustrationWorkspace(),
      window.desktop.character.library.getCharacterLibrary(),
      refreshCredentialStatus(),
    ]);
    await loadCharacterReferenceWorkspaces(library.characters);
    topics.value = workspace.topics;
    uploads.value = workspace.uploads;

    const requestedTopicId = route.query.revisionTopicId;
    let topic =
      typeof requestedTopicId === 'string'
        ? topics.value.find(item => item.id === requestedTopicId)
        : undefined;
    topic ??= topics.value[0];
    if (!topic) {
      topic = await window.desktop.illustration.createIllustrationTopic({});
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

async function send(input: string | { files: FileUIPart[]; text: string }): Promise<void> {
  const payload = typeof input === 'string' ? { files: [], text: input } : input;
  const topic = activeTopic.value;
  if (!topic || !payload.text.trim() || inputDisabled.value || chatBusy.value) {
    return;
  }
  await sendMessage(
    { files: payload.files, text: payload.text.trim() },
    { body: { model: model.value, topicId: topic.id } },
  );
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
    const topic = await window.desktop.illustration.createIllustrationTopic({});
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
    const references = topic.references
      .slice(0, maxReferences)
      .map(reference => ({ ...reference }));
    if (references.length < topic.references.length) {
      toast.info('修改版本会额外使用原插画，已将总参考图控制在 16 张以内');
    }
    const version = await window.desktop.illustration.generateIllustration({
      baseVersion: options.baseVersion,
      prompt: prompt.value.trim(),
      revisionPrompt: options.revisionPrompt,
      references,
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
      nextTopic = await window.desktop.illustration.createIllustrationTopic({});
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
  <SagPage title="插画创作" description="对话整理画面，版本持续演化" :icon="ImagePlus">
    <template #header-actions>
      <IllustrationHeader
        v-if="activeTopic"
        v-model:mobile-pane="mobilePane"
        :active-topic-id="activeTopic.id"
        :busy="navigationBusy"
        :topics="topics"
        :topic-locked="busy"
        @create="createTopic"
        @delete="deleteTopicDialogOpen = true"
        @select="selectTopic"
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
        <IllustrationWorkspacePanel
          :apimart-configured="apimartConfigured"
          :busy="generationBusy"
          :prompt="prompt"
          :polling-states="pollingStates"
          :references="referencePreviews"
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
        />
      </aside>
    </div>

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="generationBusy"
      description="可加入多个角色的正式视觉或表情，也可以加入已有插画和上传图作为本次画面的参考。"
      empty-description="还没有可加入的角色或插画素材。"
      :filters="referenceFilters"
      :max-selection="maxReferenceCount"
      :options="illustrationReferenceOptions"
      :selected-keys="selectedReferenceKeys"
      title="管理画面素材"
      @confirm="selectReferenceKeys"
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
