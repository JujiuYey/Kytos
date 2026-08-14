<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useChat } from '@ai-sdk/vue';
import { BookOpen } from '@lucide/vue';
import { toast } from 'vue-sonner';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagPage } from '@/components/sag/sag-page';
import {
  ImageReferencePickerDialog,
  type ImageReferencePickerFilter,
  type ImageReferencePickerOption,
} from '@/components/sag/image-reference-picker-dialog';
import { characterAnchorApi } from '@/lib/character-anchor-api';
import { storyApi } from '@/lib/story-api';
import { useAppStore } from '@/stores/app';
import type {
  CharacterVisualResolution,
  CharacterAnchorWorkspaceState,
  CharacterExpressionWorkspaceState,
  CharacterLibraryCharacter,
  CredentialStatus,
  IllustrationSize,
  IllustrationReference,
  IllustrationReferencePurpose,
  IllustrationWorkspaceState,
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
import { MAX_ILLUSTRATION_REFERENCE_IMAGES, STORY_AGENT_ENDPOINT } from '@/types';
import { getChatModelDefinition } from '@/types';
import type { FileUIPart } from 'ai';
import StoryChatInput from './components/story-chat-input.vue';
import StoryChatMessages from './components/story-chat-messages.vue';
import StoryCharacterPickerDialog from './components/story-character-picker-dialog.vue';
import StoryHeader from './components/story-header.vue';
import StoryShotEditorDialog from './components/story-shot-editor-dialog.vue';
import StoryWorkspacePanel from './components/story-workspace-panel.vue';

interface StoryReferenceOption extends ImageReferencePickerOption {
  reference: IllustrationReference;
}

interface CharacterReferenceWorkspace {
  anchor: CharacterAnchorWorkspaceState;
  characterId: string;
  characterName: string;
  expression: CharacterExpressionWorkspaceState;
}

const appStore = useAppStore();
const route = useRoute();
const router = useRouter();
const stories = ref<StoryProject[]>([]);
const activeStoryId = ref('');
const deepseekStatus = ref<CredentialStatus | null>(null);
const minimaxStatus = ref<CredentialStatus | null>(null);
const apimartStatus = ref<CredentialStatus | null>(null);
const characters = ref<CharacterLibraryCharacter[]>([]);
const characterReferenceWorkspaces = ref<CharacterReferenceWorkspace[]>([]);
const illustrationWorkspace = ref<IllustrationWorkspaceState | null>(null);
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
const referenceDialogOpen = ref(false);
const referenceShotId = ref<string | null>(null);
const referencePurposeByKey = ref<Record<string, IllustrationReferencePurpose>>({});
const characterDialogOpen = ref(false);
const characterDialogMode = ref<'create' | 'update'>('create');
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
const selectedCharacterWorkspaces = computed(() => {
  const selectedIds = new Set(activeStory.value?.characterIds ?? []);
  return characterReferenceWorkspaces.value.filter(workspace =>
    selectedIds.has(workspace.characterId),
  );
});
const selectedCharacterNames = computed(() => {
  const selectedIds = new Set(activeStory.value?.characterIds ?? []);
  return characters.value
    .filter(character => selectedIds.has(character.id))
    .map(character => character.name);
});
const characterAssetsReady = computed(
  () =>
    selectedCharacterWorkspaces.value.length > 0 &&
    selectedCharacterWorkspaces.value.every(workspace => {
      const actionRecordIds = new Set(
        workspace.anchor.records
          .filter(record => record.generationMode === 'action')
          .map(record => record.id),
      );
      return workspace.anchor.officialAssets.some(
        selection => !actionRecordIds.has(selection.taskId),
      );
    }),
);
const assetsReady = computed(() => characterAssetsReady.value);
const referenceFilters: ImageReferencePickerFilter[] = [
  { label: '角色锚点', value: 'character-anchor' },
  { label: '角色表情', value: 'character-expression' },
  { label: '角色动作', value: 'character-action' },
  { label: '场景与风格', value: 'illustration' },
];
const referenceOptions = computed<StoryReferenceOption[]>(() => {
  const characterOptions = selectedCharacterWorkspaces.value.flatMap(workspace => {
    const anchors = workspace.anchor.officialAssets.flatMap(selection => {
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
          detail: `${workspace.characterName} · 正式角色锚点`,
          image,
          key: referenceKey(reference),
          label: image.name || record.name,
          purpose: reference.purpose,
          reference,
          source: 'character-anchor',
        },
      ];
    });
    const actions = workspace.anchor.records
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
            key: referenceKey(reference),
            label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
            purpose: reference.purpose,
            reference,
            source: 'character-action',
          };
        }),
      );
    const expressions = workspace.expression.records.flatMap(record =>
      record.images.map((image, index) => {
        const reference: IllustrationReference = {
          characterId: workspace.characterId,
          fileName: image.fileName,
          kind: 'character-expression',
          purpose: 'character',
          taskId: record.id,
        };
        return {
          detail: `${workspace.characterName} · 角色表情`,
          image,
          key: referenceKey(reference),
          label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
          purpose: reference.purpose,
          reference,
          source: 'character-expression',
        };
      }),
    );
    return [...anchors, ...expressions, ...actions];
  });
  const uploaded = (illustrationWorkspace.value?.uploads ?? []).map(upload => {
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
      detail: `上传图片 · ${upload.originalName}`,
      image: upload,
      key: referenceKey(reference),
      label: upload.originalName,
      purpose: reference.purpose,
      reference,
      source: 'illustration',
    };
  });
  const generated = (illustrationWorkspace.value?.topics ?? []).flatMap(topic =>
    topic.versions.flatMap(version =>
      version.status === 'completed'
        ? version.images.map(image => {
            const reference: IllustrationReference = {
              fileName: image.fileName,
              kind: 'illustration',
              purpose: 'content',
              source: 'generated',
              topicId: topic.id,
              uploadId: null,
              versionId: version.id,
            };
            return {
              detail: `已有创作 · ${topic.title} V${version.versionNumber}`,
              image,
              key: referenceKey(reference),
              label: topic.title,
              purpose: reference.purpose,
              reference,
              source: 'illustration',
            };
          })
        : [],
    ),
  );
  return [...characterOptions, ...uploaded, ...generated];
});
const selectedReferenceKeys = computed(() => {
  const story = activeStory.value;
  if (!story) return [];
  const shot = referenceShotId.value
    ? story.shots.find(item => item.id === referenceShotId.value)
    : null;
  return (shot?.references.length ? shot.references : story.references).map(referenceKey);
});

function referenceKey(reference: IllustrationReference): string {
  return reference.kind === 'illustration'
    ? `illustration:${reference.source}:${reference.uploadId ?? ''}:${reference.topicId ?? ''}:${reference.versionId ?? ''}:${reference.fileName}`
    : `${reference.kind}:${reference.characterId}:${reference.taskId}:${reference.fileName}`;
}

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
    !activeStory.value.characterIds.length ||
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
    const [workspace, deepseek, minimax, apimart, library, illustration] = await Promise.all([
      storyApi.getStoryWorkspace(),
      window.desktop.settings.getCredentialStatus('deepseek'),
      window.desktop.settings.getCredentialStatus('minimax'),
      window.desktop.settings.getCredentialStatus('apimart'),
      window.desktop.character.library.getCharacterLibrary(),
      window.desktop.illustration.getIllustrationWorkspace(),
    ]);
    stories.value = workspace.stories;
    deepseekStatus.value = deepseek;
    minimaxStatus.value = minimax;
    apimartStatus.value = apimart;
    characters.value = library.characters;
    illustrationWorkspace.value = illustration;
    characterReferenceWorkspaces.value = await Promise.all(
      library.characters.map(async (character: CharacterLibraryCharacter) => {
        const [anchor, expression] = await Promise.all([
          characterAnchorApi.getWorkspace({ characterId: character.id }),
          window.desktop.character.expression.getCharacterExpressionWorkspace({
            characterId: character.id,
          }),
        ]);
        return {
          anchor,
          characterId: character.id,
          characterName: character.name,
          expression,
        };
      }),
    );

    const requestedStoryId =
      typeof route.query.storyId === 'string' ? route.query.storyId : undefined;
    if (route.query.create === '1') {
      characterDialogMode.value = 'create';
      characterDialogOpen.value = true;
      return;
    }
    let story = stories.value.find(item => item.id === requestedStoryId) ?? stories.value[0];
    if (!story) {
      characterDialogMode.value = 'create';
      characterDialogOpen.value = true;
      return;
    }
    applyStory(story);
    if (!story.characterIds.length) {
      characterDialogMode.value = 'update';
      characterDialogOpen.value = true;
    }
    if (route.query.storyId !== story.id) {
      await router.replace({ query: { storyId: story.id } });
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
      await storyApi.saveStoryConversation({
        messages: messages.value,
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

function createStory(): void {
  if (navigationBusy.value) {
    return;
  }
  characterDialogMode.value = 'create';
  characterDialogOpen.value = true;
}

function manageStoryCharacters(): void {
  if (!activeStory.value || navigationBusy.value) return;
  characterDialogMode.value = 'update';
  characterDialogOpen.value = true;
}

function setCharacterDialogOpen(open: boolean): void {
  characterDialogOpen.value = open;
  if (!open && !activeStory.value) {
    void router.replace('/stories');
  }
}

async function confirmStoryCharacters(characterIds: string[]): Promise<void> {
  if (isMutating.value) return;
  isMutating.value = true;
  try {
    if (characterDialogMode.value === 'create') {
      const story = await storyApi.createStory({ characterIds });
      replaceStory(story);
      applyStory(story);
      await router.replace({ query: { storyId: story.id } });
    } else if (activeStory.value) {
      replaceStory(
        await storyApi.updateStory({
          characterIds,
          storyId: activeStory.value.id,
        }),
      );
    }
    characterDialogOpen.value = false;
  } catch (createError: unknown) {
    toast.error(createError instanceof Error ? createError.message : String(createError));
  } finally {
    isMutating.value = false;
  }
}

function selectStory(storyId: string): void {
  const story = stories.value.find(item => item.id === storyId);
  if (!story || navigationBusy.value) {
    return;
  }
  applyStory(story);
  void router.replace({ query: { storyId: story.id } });
}

async function updateProject(
  patch: Partial<{
    confirmStoryboard: boolean;
    keyShotId: string;
    resolution: CharacterVisualResolution;
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
    replaceStory(await storyApi.updateStory({ ...patch, storyId: story.id }));
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
      const result = await storyApi.updateStoryShot({
        ...content,
        shotId: editorTarget.value.id,
        storyId: story.id,
      });
      replaceShot(result.shot, result.storyboardReady);
    } else {
      replaceStory(await storyApi.createStoryShot({ ...content, storyId: story.id }));
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
      await storyApi.moveStoryShot({
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
  pollingStates.value = {
    ...pollingStates.value,
    [taskId]: { phase: 'waiting' },
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
  pollingStates.value = {
    ...pollingStates.value,
    [taskId]: { phase: 'requesting' },
  };
  try {
    const version = await storyApi.getStoryShotTask(taskId);
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
      [taskId]: { phase: 'paused' },
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
    const version = await storyApi.generateStoryShot({
      baseVersion: baseReferences.value[shot.id] ?? null,
      prompt: shot.finalPrompt,
      references: shot.references.length ? shot.references : story.references,
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

function openReferences(shot: StoryShot | null): void {
  referenceShotId.value = shot?.id ?? null;
  const currentReferences = shot?.references.length
    ? shot.references
    : (activeStory.value?.references ?? []);
  referencePurposeByKey.value = Object.fromEntries(
    currentReferences.map(reference => [
      referenceKey(reference),
      reference.purpose ?? (reference.kind === 'illustration' ? 'content' : 'character'),
    ]),
  );
  if (!shot) assignOnlyIllustrationAsStyle(currentReferences.map(referenceKey));
  referenceDialogOpen.value = true;
}

function assignOnlyIllustrationAsStyle(keys: string[]): void {
  if (referenceShotId.value) return;
  const selectedOptions = keys.flatMap(key => {
    const option = referenceOptions.value.find(item => item.key === key);
    return option ? [option] : [];
  });
  const illustrationOptions = selectedOptions.filter(
    option => option.reference.kind === 'illustration',
  );
  const hasStyle = selectedOptions.some(
    option => (referencePurposeByKey.value[option.key] ?? option.reference.purpose) === 'style',
  );
  if (illustrationOptions.length !== 1 || hasStyle) return;
  const styleOption = illustrationOptions[0];
  if (!styleOption) return;
  referencePurposeByKey.value = {
    ...referencePurposeByKey.value,
    [styleOption.key]: 'style',
  };
}

function updateReferencePurpose(payload: {
  key: string;
  purpose: IllustrationReferencePurpose;
}): void {
  const nextPurposes = { ...referencePurposeByKey.value };
  if (payload.purpose === 'style') {
    Object.entries(nextPurposes).forEach(([key, purpose]) => {
      if (key !== payload.key && purpose === 'style') nextPurposes[key] = 'content';
    });
  }
  nextPurposes[payload.key] = payload.purpose;
  referencePurposeByKey.value = nextPurposes;
}

async function confirmReferences(keys: string[]): Promise<void> {
  const story = activeStory.value;
  if (!story || isMutating.value) return;
  assignOnlyIllustrationAsStyle(keys);
  let references = keys.flatMap(key => {
    const option = referenceOptions.value.find(item => item.key === key);
    if (!option) return [];
    const purpose =
      referencePurposeByKey.value[key] ??
      option.reference.purpose ??
      (option.reference.kind === 'illustration' ? 'content' : 'character');
    return [
      {
        ...option.reference,
        purpose: referenceShotId.value && purpose === 'style' ? 'content' : purpose,
      },
    ];
  });
  const illustrationReferences = references.filter(reference => reference.kind === 'illustration');
  if (
    !referenceShotId.value &&
    illustrationReferences.length === 1 &&
    !references.some(reference => reference.purpose === 'style')
  ) {
    const onlyIllustration = illustrationReferences[0];
    references = references.map(reference =>
      reference === onlyIllustration ? { ...reference, purpose: 'style' as const } : reference,
    );
  }
  if (
    !referenceShotId.value &&
    references.filter(reference => reference.purpose === 'style').length !== 1
  ) {
    toast.error('故事默认参考必须设置且只保留一张风格基准');
    return;
  }
  isMutating.value = true;
  try {
    if (referenceShotId.value) {
      const result = await storyApi.updateStoryShot({
        references,
        shotId: referenceShotId.value,
        storyId: story.id,
      });
      replaceShot(result.shot, result.storyboardReady);
    } else {
      replaceStory(await storyApi.updateStory({ references, storyId: story.id }));
    }
    referenceDialogOpen.value = false;
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isMutating.value = false;
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
      await storyApi.selectStoryShotVersion({
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
  void router.push(characterAssetsReady.value ? '/illustration-library' : '/character-anchor');
}

async function confirmDeleteStory(): Promise<void> {
  const story = activeStory.value;
  if (!story || isDeleting.value) {
    return;
  }
  isDeleting.value = true;
  try {
    const workspace = await storyApi.deleteStory({ storyId: story.id });
    stories.value = workspace.stories;
    deleteStoryDialogOpen.value = false;
    let nextStory = stories.value[0];
    if (!nextStory) {
      activeStoryId.value = '';
      messages.value = [];
      await router.replace({ query: {} });
      characterDialogMode.value = 'create';
      characterDialogOpen.value = true;
      return;
    }
    applyStory(nextStory);
    await router.replace({ query: { storyId: nextStory.id } });
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
    replaceStory(await storyApi.deleteStoryShot({ shotId: shot.id, storyId: story.id }));
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
      await storyApi.deleteStoryShotVersion({
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
  <SagPage title="故事创作" description="聊故事，拆分镜，逐张完成画面" :icon="BookOpen">
    <template #header-actions>
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
      :class="[
        'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden',
        workspaceTab === 'storyboard'
          ? 'lg:grid-cols-1'
          : 'lg:grid-cols-[minmax(0,4fr)_minmax(440px,3fr)]',
      ]"
    >
      <section
        :class="[
          'min-h-0 min-w-0 flex-col overflow-hidden',
          workspaceTab === 'storyboard' ? 'lg:hidden' : 'lg:flex',
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
          :polling-states="pollingStates"
          :story="activeStory"
          :submitting-shot-ids="submittingShotIds"
          :reference-options="referenceOptions"
          :character-names="selectedCharacterNames"
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
          @manage-characters="manageStoryCharacters"
          @open-references="openReferences"
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

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="isMutating"
      :close-on-confirm="false"
      description="选择参考图，并将其中一张上传或创作图片设为风格基准。"
      :filters="referenceFilters"
      :max-selection="MAX_ILLUSTRATION_REFERENCE_IMAGES"
      :options="referenceOptions"
      :allow-purpose-selection="referenceShotId === null"
      :purpose-by-key="referencePurposeByKey"
      :selected-keys="selectedReferenceKeys"
      title="选择故事参考图"
      @confirm="confirmReferences"
      @purpose-change="updateReferencePurpose"
      @selection-change="assignOnlyIllustrationAsStyle"
    />

    <StoryCharacterPickerDialog
      :open="characterDialogOpen"
      :busy="isMutating"
      :characters="characters"
      :mode="characterDialogMode"
      :selected-ids="activeStory?.characterIds ?? []"
      @confirm="confirmStoryCharacters"
      @manage-characters="router.push('/character')"
      @update:open="setCharacterDialogOpen"
    />

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
