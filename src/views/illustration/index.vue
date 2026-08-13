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
import { characterAnchorApi } from '@/lib/character-anchor-api';
import { useAppStore } from '@/stores/app';
import type {
  CharacterLibraryCharacter,
  CharacterExpressionWorkspaceState,
  CharacterVisualResolution,
  CharacterAnchorWorkspaceState,
  IllustrationAgentMessage,
  IllustrationBriefUpdateResult,
  IllustrationReference,
  IllustrationRevisionReference,
  IllustrationSize,
  IllustrationTopic,
  IllustrationVersion,
  UploadedIllustration,
} from '@/types';
import { ILLUSTRATION_AGENT_ENDPOINT, MAX_ILLUSTRATION_REFERENCE_IMAGES } from '@/types';
import { cloneJsonData } from '@/utils/serialization';
import { getChatModelDefinition } from '@/types';
import IllustrationChatInput from './components/illustration-chat-input.vue';
import IllustrationChatMessages from './components/illustration-chat-messages.vue';
import IllustrationHeader from './components/illustration-header.vue';
import IllustrationWorkspacePanel from './components/illustration-workspace-panel.vue';

interface IllustrationReferenceOption extends ImageReferencePickerOption {
  reference: IllustrationReference;
}

interface CharacterReferenceWorkspace {
  anchor: CharacterAnchorWorkspaceState;
  characterId: string;
  characterName: string;
  expression: CharacterExpressionWorkspaceState;
}

const MAX_REVISION_INSTRUCTION_LENGTH = 20_000;

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
const isUploadingChatImages = ref(false);
const isDeleting = ref(false);
const deleteTopicDialogOpen = ref(false);
const deleteVersionTarget = ref<IllustrationVersion | null>(null);
const referenceDialogOpen = ref(false);
const mobilePane = ref<'chat' | 'workspace'>('chat');
const prompt = ref('');
const size = ref<IllustrationSize>('16:9');
const resolution = ref<CharacterVisualResolution>('1k');
const revisionTarget = ref<IllustrationVersion | null>(null);
const revisionUploadTarget = ref<UploadedIllustration | null>(null);
const revisionInstructions = ref<string[]>([]);
const pendingRevisionTaskId = ref<string | null>(null);
const selectedVersionId = ref<string | null>(null);
const transientChatReferences = ref<IllustrationReference[]>([]);

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
  onCompleted: (id, version) => {
    toast.success(`V${version.versionNumber} 已生成并保存到工作区`);
    const owner = topics.value.find(topic => topic.versions.some(item => item.id === version.id));
    if (owner?.id === activeTopicId.value) {
      selectedVersionId.value = version.id;
      if ((version.baseVersion || pendingRevisionTaskId.value === id) && version.images.length) {
        revisionTarget.value = version;
        revisionUploadTarget.value = null;
        revisionInstructions.value = [];
        pendingRevisionTaskId.value = null;
      }
      mobilePane.value = 'workspace';
    }
  },
  onFailed: (id, version) => {
    if (pendingRevisionTaskId.value === id) {
      pendingRevisionTaskId.value = null;
    }
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
  { label: '角色锚点', value: 'character-anchor' },
  { label: '角色表情', value: 'character-expression' },
  { label: '角色动作', value: 'character-action' },
  { label: '已有插画', value: 'illustration' },
];
const illustrationReferenceOptions = computed<IllustrationReferenceOption[]>(() => {
  const characterOptions = characterReferenceWorkspaces.value.flatMap(workspace => {
    const anchorOptions = workspace.anchor.officialAssets.flatMap(selection => {
      const record = workspace.anchor.records.find(item => item.id === selection.taskId);
      const image = record?.images.find(item => item.fileName === selection.fileName);
      if (!record || !image || record.generationMode === 'action') return [];
      const reference: IllustrationReference = {
        characterId: workspace.characterId,
        fileName: image.fileName,
        kind: 'character-anchor',
        purpose: 'character',
        taskId: record.id,
      };
      return [
        {
          detail: `${workspace.characterName} · 正式锚点 · ${record.size}`,
          image,
          key: illustrationReferenceKey(reference),
          label: image.name || record.name || '正式角色锚点',
          reference,
          source: 'character-anchor',
        },
      ];
    });
    const actionOptions = workspace.anchor.records
      .filter(record => record.status === 'completed' && record.generationMode === 'action')
      .flatMap(record =>
        record.images.map((image, index) => {
          const reference: IllustrationReference = {
            characterId: workspace.characterId,
            fileName: image.fileName,
            kind: 'character-action',
            purpose: 'character',
            taskId: record.id,
          };
          return {
            detail: `${workspace.characterName} · 角色动作`,
            image,
            key: illustrationReferenceKey(reference),
            label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
            reference,
            source: 'character-action',
          };
        }),
      );
    const expressionOptions = workspace.expression.records.flatMap(record =>
      record.images.map((image, index) => {
        const reference: IllustrationReference = {
          characterId: workspace.characterId,
          fileName: image.fileName,
          kind: 'character-expression',
          purpose: 'character',
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
    return [...anchorOptions, ...expressionOptions, ...actionOptions];
  });
  const uploadedOptions = uploads.value.map(upload => {
    const reference: IllustrationReference = {
      fileName: upload.fileName,
      kind: 'illustration',
      purpose: 'content',
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
              purpose: 'style',
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
const referencePreviews = computed(() =>
  (activeTopic.value?.references ?? []).flatMap(reference => {
    const key = illustrationReferenceKey(reference);
    const option = illustrationReferenceOptions.value.find(item => item.key === key);
    if (!option) return [];
    return [
      {
        detail: option.detail,
        image: option.image,
        key,
        label: option.label,
      },
    ];
  }),
);
const revisionActive = computed(() => Boolean(revisionTarget.value || revisionUploadTarget.value));
const revisionImage = computed(() => {
  const versionImage = revisionTarget.value?.images[0];
  if (versionImage) return versionImage;
  const upload = revisionUploadTarget.value;
  return upload ? { fileName: upload.fileName, mimeType: upload.mimeType, url: upload.url } : null;
});
const revisionLabel = computed(() => {
  if (revisionTarget.value) return `V${revisionTarget.value.versionNumber}`;
  return revisionUploadTarget.value?.originalName ?? null;
});
const revisionReference = computed<IllustrationRevisionReference | null>(() => {
  const image = revisionImage.value;
  if (!image) return null;
  if (revisionTarget.value) {
    return {
      fileName: image.fileName,
      source: 'generated',
      versionId: revisionTarget.value.id,
    };
  }
  if (revisionUploadTarget.value) {
    return {
      fileName: image.fileName,
      source: 'uploaded',
      uploadId: revisionUploadTarget.value.id,
    };
  }
  return null;
});
const maxReferenceCount = computed(
  () => MAX_ILLUSTRATION_REFERENCE_IMAGES - Number(revisionActive.value),
);

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
    .map(option => {
      const current = topic.references.find(
        reference => illustrationReferenceKey(reference) === option.key,
      );
      return { ...(current ?? option.reference) };
    });
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
const busy = computed(
  () => chatBusy.value || generationBusy.value || isUploadingChatImages.value || isDeleting.value,
);
const navigationBusy = computed(
  () => chatBusy.value || isUploadingChatImages.value || isDeleting.value,
);
const inputDisabled = computed(
  () =>
    isInitializing.value ||
    !activeTopic.value ||
    !chatProviderConfigured.value ||
    (Boolean(activeTopic.value.references.length) && !supportsImageInput.value) ||
    (revisionActive.value && !supportsImageInput.value) ||
    isUploadingChatImages.value ||
    chatStatus.value === 'error',
);
const revisionReady = computed(() => revisionActive.value && revisionInstructions.value.length > 0);
const adjustmentBasePreview = computed(() => {
  const image = revisionImage.value;
  const label = revisionLabel.value;
  return image && label ? { image, label } : null;
});
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
  transientChatReferences.value = [];
  revisionTarget.value = null;
  revisionUploadTarget.value = null;
  revisionInstructions.value = [];
  pendingRevisionTaskId.value = null;
  selectedVersionId.value = topic.versions[0]?.id ?? null;
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
      const [anchor, expression] = await Promise.all([
        characterAnchorApi.getWorkspace({ characterId: character.id }),
        window.desktop.character.expression.getCharacterExpressionWorkspace({
          characterId: character.id,
        }),
      ]);
      return {
        characterId: character.id,
        characterName: character.name,
        expression,
        anchor,
      };
    }),
  );
}

function clearRequestedRevisionQuery(): void {
  const {
    revisionTopicId: _revisionTopicId,
    revisionUploadId: _revisionUploadId,
    revisionVersionId: _revisionVersionId,
    ...query
  } = route.query;
  void router.replace({ query });
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
  startVersionAdjustment(version);
  clearRequestedRevisionQuery();
}

function getUploadRevisionTopicTitle(upload: UploadedIllustration): string {
  const extensionIndex = upload.originalName.lastIndexOf('.');
  const baseName =
    extensionIndex > 0 ? upload.originalName.slice(0, extensionIndex) : upload.originalName;
  return `修改 ${baseName}`.slice(0, 100);
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

    const requestedUploadId = route.query.revisionUploadId;
    const requestedUpload =
      typeof requestedUploadId === 'string'
        ? uploads.value.find(item => item.id === requestedUploadId)
        : undefined;
    if (requestedUpload) {
      let topic = await window.desktop.illustration.createIllustrationTopic({});
      topic = await window.desktop.illustration.updateIllustrationTopic({
        title: getUploadRevisionTopicTitle(requestedUpload),
        topicId: topic.id,
      });
      topics.value = [topic, ...topics.value];
      applyTopic(topic);
      startUploadAdjustment(requestedUpload);
      clearRequestedRevisionQuery();
    } else {
      if (typeof requestedUploadId === 'string') {
        toast.error('要修改的上传插画已不存在');
        clearRequestedRevisionQuery();
      }
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
    }
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

async function uploadChatFiles(
  files: FileUIPart[],
  topic: IllustrationTopic,
): Promise<{ files: FileUIPart[]; references: IllustrationReference[] }> {
  if (!files.length) return { files: [], references: [] };
  if (topic.references.length + files.length > maxReferenceCount.value) {
    throw new Error(
      revisionActive.value
        ? `调整底图会占用 1 张图片，请将其他参考图控制在 ${maxReferenceCount.value} 张以内`
        : `当前主题最多使用 ${MAX_ILLUSTRATION_REFERENCE_IMAGES} 张参考图，请先移除部分素材`,
    );
  }
  const uploaded = await Promise.all(
    files.map(async file => {
      const response = await fetch(file.url);
      const saved = await window.desktop.illustration.uploadIllustration({
        fileData: new Uint8Array(await response.arrayBuffer()),
        fileName: file.filename || 'chat-reference.png',
        mimeType: file.mediaType,
      });
      return { file, saved };
    }),
  );
  uploads.value = [...uploaded.map(item => item.saved), ...uploads.value];
  const references = uploaded.map(({ saved }) => ({
    fileName: saved.fileName,
    kind: 'illustration' as const,
    purpose: 'content' as const,
    source: 'uploaded' as const,
    topicId: null,
    uploadId: saved.id,
    versionId: null,
  }));
  return {
    files: uploaded.map(({ file, saved }) => ({
      filename: file.filename || saved.originalName,
      mediaType: saved.mimeType,
      type: 'file' as const,
      url: saved.url,
    })),
    references,
  };
}

async function send(input: string | { files: FileUIPart[]; text: string }): Promise<void> {
  const payload = typeof input === 'string' ? { files: [], text: input } : input;
  const topic = activeTopic.value;
  if (!topic || !payload.text.trim() || inputDisabled.value || chatBusy.value) {
    return;
  }
  isUploadingChatImages.value = payload.files.length > 0;
  try {
    const uploaded = await uploadChatFiles(payload.files, topic);
    transientChatReferences.value = uploaded.references;
    const currentRevisionImage = revisionImage.value;
    const currentRevisionLabel = revisionLabel.value;
    const revisionFiles =
      revisionActive.value && currentRevisionImage && currentRevisionLabel
        ? [
            {
              filename: `正在讨论 ${currentRevisionLabel}`,
              mediaType: currentRevisionImage.mimeType,
              type: 'file' as const,
              url: currentRevisionImage.url,
            },
          ]
        : [];
    if (revisionActive.value) {
      revisionInstructions.value = [...revisionInstructions.value, payload.text.trim()];
    }
    await sendMessage(
      { files: [...revisionFiles, ...uploaded.files], text: payload.text.trim() },
      {
        body: {
          model: model.value,
          references: uploaded.references,
          revisionBase: revisionReference.value,
          topicId: topic.id,
        },
      },
    );
  } catch (sendError: unknown) {
    toast.error(sendError instanceof Error ? sendError.message : String(sendError));
  } finally {
    isUploadingChatImages.value = false;
  }
}

async function retry(): Promise<void> {
  const topic = activeTopic.value;
  if (!topic || chatStatus.value !== 'error') {
    return;
  }
  await regenerate({
    body: {
      model: model.value,
      references: transientChatReferences.value,
      revisionBase: revisionReference.value,
      topicId: topic.id,
    },
  });
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

async function generate(): Promise<boolean> {
  const topic = activeTopic.value;
  const currentRevisionReference = revisionReference.value;
  if (
    !topic ||
    generationBusy.value ||
    !prompt.value.trim() ||
    (revisionActive.value && (!currentRevisionReference || !revisionInstructions.value.length))
  ) {
    return false;
  }
  isGenerating.value = true;
  generationError.value = '';
  try {
    const maxReferences = Math.max(
      0,
      MAX_ILLUSTRATION_REFERENCE_IMAGES - Number(revisionActive.value),
    );
    const references = topic.references
      .slice(0, maxReferences)
      .map(reference => ({ ...reference }));
    if (references.length < topic.references.length) {
      toast.info('调整底图会额外使用原插画，已将总参考图控制在 16 张以内');
    }
    const version = await window.desktop.illustration.generateIllustration({
      prompt: prompt.value.trim(),
      revisionBase: currentRevisionReference,
      revisionPrompt: revisionActive.value
        ? revisionInstructions.value.join('\n').slice(-MAX_REVISION_INSTRUCTION_LENGTH)
        : null,
      references,
      resolution: resolution.value,
      size: size.value,
      topicId: topic.id,
    });
    pendingRevisionTaskId.value = revisionActive.value ? version.id : null;
    selectedVersionId.value = version.id;
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

function startVersionAdjustment(version: IllustrationVersion): void {
  if (version.status !== 'completed' || !version.images.length) {
    return;
  }
  if (revisionTarget.value?.id !== version.id) {
    revisionInstructions.value = [];
  }
  revisionTarget.value = version;
  revisionUploadTarget.value = null;
  if ((activeTopic.value?.references.length ?? 0) > maxReferenceCount.value) {
    toast.info(`调整版本会额外使用原插画，生图时只会使用前 ${maxReferenceCount.value} 张素材`);
  }
  selectedVersionId.value = version.id;
  mobilePane.value = 'chat';
}

function startUploadAdjustment(upload: UploadedIllustration): void {
  if (revisionUploadTarget.value?.id !== upload.id) {
    revisionInstructions.value = [];
  }
  revisionTarget.value = null;
  revisionUploadTarget.value = upload;
  if ((activeTopic.value?.references.length ?? 0) > maxReferenceCount.value) {
    toast.info(`调整底图会额外占用一张图片，生图时只会使用前 ${maxReferenceCount.value} 张素材`);
  }
  mobilePane.value = 'chat';
}

function clearRevisionTarget(): void {
  if (chatBusy.value || generationBusy.value) {
    return;
  }
  revisionTarget.value = null;
  revisionUploadTarget.value = null;
  revisionInstructions.value = [];
}

function selectVersion(version: IllustrationVersion): void {
  selectedVersionId.value = version.id;
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
      revisionInstructions.value = [];
    }
    if (selectedVersionId.value === version.id) {
      selectedVersionId.value = updatedTopic.versions[0]?.id ?? null;
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
      class="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,5fr)_minmax(400px,2fr)]"
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
          :adjustment-base="adjustmentBasePreview"
          :disabled="inputDisabled"
          :provider-name="chatProvider === 'minimax' ? 'MiniMax' : 'DeepSeek'"
          :references="referencePreviews"
          :supports-image-input="supportsImageInput"
          :status="chatStatus"
          :uploading="isUploadingChatImages"
          @open-library="referenceDialogOpen = true"
          @clear-adjustment="clearRevisionTarget"
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
          :chat-busy="chatBusy"
          :prompt="prompt"
          :polling-states="pollingStates"
          :references="referencePreviews"
          :revision-active="revisionActive"
          :revision-label="revisionLabel"
          :revision-ready="revisionReady"
          :revision-version-id="revisionTarget?.id ?? null"
          :resolution="resolution"
          :selected-version-id="selectedVersionId"
          :size="size"
          :topic="activeTopic"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @delete-version="deleteVersionTarget = $event"
          @generate="generate"
          @open-reference-picker="referenceDialogOpen = true"
          @rename="renameTopic"
          @revise="startVersionAdjustment"
          @select-version="selectVersion"
          @update:prompt="prompt = $event"
          @update:resolution="resolution = $event"
          @update:size="size = $event"
        />
      </aside>
    </div>

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="generationBusy"
      description="可加入多个角色的正式锚点或表情，也可以加入已有插画和上传图作为本次画面的参考。"
      empty-description="还没有可加入的角色或插画素材。"
      :filters="referenceFilters"
      :max-selection="maxReferenceCount"
      :options="illustrationReferenceOptions"
      :selected-keys="selectedReferenceKeys"
      title="管理画面素材"
      @confirm="selectReferenceKeys"
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
