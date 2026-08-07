<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertCircle, Camera } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import {
  ImageReferencePickerDialog,
  type ImageReferencePickerOption,
} from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagMissingPrerequisiteAlert } from '@/components/sag/missing-prerequisite-alert';
import { SagPage } from '@/components/sag/sag-page';
import { useAppStore } from '@/stores/app';
import { useCharacterLibraryStore } from '@/stores/character-library';
import type {
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualSize,
  CharacterVisualWorkspaceState,
  CredentialStatus,
} from '@/types';
import { getChatModelDefinition, MAX_CHARACTER_ACTION_LENGTH } from '@/types';
import { useCharacterVisualUpload } from './composables/use-character-visual-upload';
import { useCharacterVisualRename } from './composables/use-character-visual-rename';
import { useCharacterVisualGenerator } from './composables/use-character-visual-generator';
import CharacterActionGeneratorPanel from './components/character-action-generator-panel.vue';
import VisualGallery from './components/visual-gallery.vue';
import VisualPageHeader from './components/visual-page-header.vue';
import VisualAssetRenameDialog from './components/visual-asset-rename-dialog.vue';
import VisualUploadDialog from './components/visual-upload-dialog.vue';

interface ActionReferenceOption extends ImageReferencePickerOption {
  selection: CharacterVisualAssetSelection;
}

const appStore = useAppStore();
const characterLibraryStore = useCharacterLibraryStore();
const route = useRoute();
const router = useRouter();

// 角色选择
const selectedCharacterId = ref('');
const characters = computed(() => characterLibraryStore.characters);

// 视觉工作区
const records = ref<CharacterVisualAssetRecord[]>([]);
const officialAssets = ref<CharacterVisualAssetSelection[]>([]);
const errorMessage = ref('');
const isInitializing = ref(true);

const activeStatuses = ['submitted', 'pending', 'processing'];
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const assetCount = computed(() =>
  records.value.reduce((total, record) => total + record.images.length, 0),
);

// 参考资产
const selectedReferenceAsset = ref<CharacterVisualAssetSelection | null>(null);

function referenceAssetKey(selection: CharacterVisualAssetSelection): string {
  return `${selection.taskId}:${selection.fileName}`;
}

const referenceOptions = computed<ActionReferenceOption[]>(() =>
  officialAssets.value.flatMap(selection => {
    const record = records.value.find(item => item.id === selection.taskId);
    const image = record?.images.find(item => item.fileName === selection.fileName);
    if (!record || !image) return [];
    return [
      {
        detail: `${record.source === 'uploaded' ? '已上传' : '已生成'} · 正式视觉`,
        image,
        key: referenceAssetKey(selection),
        label: image.name || record.name || '角色视觉',
        selection,
        source: 'visual',
      },
    ];
  }),
);
const selectedReferenceKeys = computed(() =>
  selectedReferenceAsset.value ? [referenceAssetKey(selectedReferenceAsset.value)] : [],
);
const selectedReferenceOptions = computed(() => {
  const selectedKey = selectedReferenceKeys.value[0];
  return selectedKey ? referenceOptions.value.filter(option => option.key === selectedKey) : [];
});
const hasOfficialReference = computed(() => referenceOptions.value.length > 0);

function syncSelectedReference(preferred?: CharacterVisualAssetSelection | null): void {
  const availableKeys = new Set(referenceOptions.value.map(option => option.key));
  const currentKey = selectedReferenceAsset.value
    ? referenceAssetKey(selectedReferenceAsset.value)
    : '';
  const preferredKey = preferred ? referenceAssetKey(preferred) : '';
  const nextOption =
    (availableKeys.has(currentKey) &&
      referenceOptions.value.find(option => option.key === currentKey)) ||
    (availableKeys.has(preferredKey) &&
      referenceOptions.value.find(option => option.key === preferredKey)) ||
    referenceOptions.value[0];
  selectedReferenceAsset.value = nextOption?.selection ?? null;
}

function selectReferenceAsset(keys: string[]): void {
  selectedReferenceAsset.value =
    referenceOptions.value.find(option => option.key === keys[0])?.selection ?? null;
}

// 任务轮询
const isPolling = ref(false);
const pollingState = ref<GenerationTaskPollingState>({ phase: 'idle', taskId: '' });
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;
let loadRequestId = 0;

function clearPollTimer(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function resetPollingState(): void {
  pollingState.value = { phase: 'idle', taskId: '' };
}

function schedulePoll(taskId: string): void {
  clearPollTimer();
  pollingState.value = {
    phase: 'waiting',
    taskId,
  };
  pollTimer = setTimeout(() => {
    void pollVisualTask(taskId);
  }, 2500);
}

async function pollVisualTask(taskId: string): Promise<void> {
  if (isDisposed) {
    return;
  }
  isPolling.value = true;
  pollingState.value = {
    phase: 'requesting',
    taskId,
  };
  try {
    const record = await window.desktop.character.assets.getCharacterVisualAssetTask(taskId);
    records.value = replaceRecord(records.value, record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll(taskId);
      return;
    }
    resetPollingState();
    if (record.status === 'completed') {
      toast.success(`“${record.name}”已生成并保存到角色视觉`);
    } else {
      errorMessage.value = record.errorMessage || '角色视觉生成任务未完成';
    }
  } catch (pollError: unknown) {
    pollingState.value = { ...pollingState.value, phase: 'paused' };
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  } finally {
    isPolling.value = false;
  }
}

function retryPolling(): void {
  if (!activeRecord.value || isPolling.value) {
    return;
  }
  errorMessage.value = '';
  void pollVisualTask(activeRecord.value.id);
}

// 生成器
const action = ref('自然站立，抬起右手挥手，左手自然垂下。');
const imageName = ref('挥手');
const size = ref<CharacterVisualSize>('2:3');
const resolution = ref<CharacterVisualResolution>('1k');
const count = ref(2);
const isSubmitting = ref(false);
const isGeneratingPrompt = ref(false);

const credentialStatus = ref<CredentialStatus | null>(null);
const deepseekStatus = ref<CredentialStatus | null>(null);
const minimaxStatus = ref<CredentialStatus | null>(null);

const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const fastModelProvider = computed(
  () => getChatModelDefinition(appStore.settings.fastModel).provider,
);
const promptGenerationAvailable = computed(() =>
  fastModelProvider.value === 'minimax'
    ? Boolean(minimaxStatus.value?.configured)
    : Boolean(deepseekStatus.value?.configured),
);

async function generateActions(): Promise<void> {
  const referenceAsset = selectedReferenceAsset.value;
  if (isGenerateDisabled.value || !referenceAsset) {
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const record = await window.desktop.character.assets.generateCharacterAction({
      action: action.value.trim(),
      count: count.value,
      name: imageName.value.trim(),
      referenceAsset: { ...referenceAsset },
      resolution: resolution.value,
      size: size.value,
    });
    records.value = replaceRecord(records.value, record);
    await pollVisualTask(record.id);
  } catch (generationError: unknown) {
    errorMessage.value =
      generationError instanceof Error ? generationError.message : String(generationError);
  } finally {
    isSubmitting.value = false;
  }
}

async function generateActionPrompt(): Promise<void> {
  if (isGeneratingPrompt.value || !promptGenerationAvailable.value || !imageName.value.trim()) {
    return;
  }
  isGeneratingPrompt.value = true;
  try {
    action.value = await window.desktop.character.assets.generateCharacterActionPrompt({
      model: appStore.settings.fastModel,
      name: imageName.value.trim(),
    });
    toast.success('动作提示词已生成');
  } catch (promptError: unknown) {
    toast.error(promptError instanceof Error ? promptError.message : String(promptError));
  } finally {
    isGeneratingPrompt.value = false;
  }
}

// 资产操作
const selectingFileName = ref('');
const deletingFileName = ref('');
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{
  image: CharacterVisualImage;
  record: CharacterVisualAssetRecord;
} | null>(null);
const referenceDialogOpen = ref(false);
const { openUploadDialog, uploadDialogOpen } = useCharacterVisualUpload();
const { renameAsset, renameDialogOpen, renamingFileName, renameTarget, requestRename } =
  useCharacterVisualRename({
    onRenamed(nextRecords) {
      records.value = nextRecords;
    },
  });

const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const characterSelectionDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    isGeneratingPrompt.value ||
    Boolean(selectingFileName.value) ||
    Boolean(renamingFileName.value) ||
    Boolean(deletingFileName.value),
);
const operationDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    isGeneratingPrompt.value ||
    !selectedCharacterId.value ||
    Boolean(selectingFileName.value) ||
    Boolean(renamingFileName.value) ||
    Boolean(deletingFileName.value),
);
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    isGeneratingPrompt.value ||
    !selectedCharacterId.value ||
    !keyConfigured.value ||
    !selectedReferenceAsset.value ||
    !imageName.value.trim() ||
    imageName.value.length > 80 ||
    !action.value.trim() ||
    action.value.length > MAX_CHARACTER_ACTION_LENGTH,
);

const { closeGenerator, generatorOpen, openGenerator } = useCharacterVisualGenerator({
  disabled: operationDisabled,
  onOpen: refreshVisualWorkspace,
});

// 工作区加载
function replaceRecord<TRecord extends CharacterVisualAssetRecord>(
  recordList: TRecord[],
  updatedRecord: TRecord,
): TRecord[] {
  return [updatedRecord, ...recordList.filter(record => record.id !== updatedRecord.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function applyWorkspace(
  workspace: CharacterVisualWorkspaceState,
  preferredReference?: CharacterVisualAssetSelection | null,
): void {
  officialAssets.value = workspace.officialAssets;
  records.value = workspace.records;
  syncSelectedReference(preferredReference);
}

function applyCharacterWorkspace(visualWorkspace: CharacterVisualWorkspaceState): void {
  const latestGeneratedRecord = visualWorkspace.records.find(
    record => record.generationMode === 'action',
  );
  applyWorkspace(visualWorkspace, latestGeneratedRecord?.referenceAssets[0]);
  action.value = latestGeneratedRecord?.prompt || '自然站立，抬起右手挥手，左手自然垂下。';
  imageName.value = latestGeneratedRecord?.name || '挥手';
  size.value = latestGeneratedRecord?.size ?? '2:3';
  resolution.value = latestGeneratedRecord?.resolution ?? '1k';
  count.value = latestGeneratedRecord?.count ?? 2;

  const unfinishedRecord = visualWorkspace.records.find(record =>
    activeStatuses.includes(record.status),
  );
  if (unfinishedRecord) {
    schedulePoll(unfinishedRecord.id);
  }
}

async function loadCharacterWorkspace(characterId: string): Promise<void> {
  const requestId = ++loadRequestId;
  clearPollTimer();
  resetPollingState();
  isPolling.value = false;
  isInitializing.value = true;
  errorMessage.value = '';
  records.value = [];
  officialAssets.value = [];
  selectedReferenceAsset.value = null;
  try {
    const visualWorkspace = await window.desktop.character.assets.getCharacterVisualWorkspace({
      characterId,
    });
    if (requestId !== loadRequestId || selectedCharacterId.value !== characterId) {
      return;
    }
    applyCharacterWorkspace(visualWorkspace);
  } catch (initializationError: unknown) {
    if (requestId !== loadRequestId) {
      return;
    }
    errorMessage.value =
      initializationError instanceof Error
        ? initializationError.message
        : String(initializationError);
  } finally {
    if (requestId === loadRequestId) {
      isInitializing.value = false;
    }
  }
}

async function refreshVisualWorkspace(): Promise<void> {
  try {
    applyWorkspace(
      await window.desktop.character.assets.getCharacterVisualWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
  } catch (refreshError: unknown) {
    errorMessage.value =
      refreshError instanceof Error ? refreshError.message : String(refreshError);
  }
}

async function selectCharacter(characterId: string): Promise<void> {
  if (
    characterSelectionDisabled.value ||
    characterId === selectedCharacterId.value ||
    !characters.value.some(character => character.id === characterId)
  ) {
    return;
  }
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    await window.desktop.character.library.selectCharacter({ characterId });
    selectedCharacterId.value = characterId;
    await loadCharacterWorkspace(characterId);
  } catch (selectionError: unknown) {
    errorMessage.value =
      selectionError instanceof Error ? selectionError.message : String(selectionError);
    isInitializing.value = false;
  }
}

async function selectAsset(
  record: CharacterVisualAssetRecord,
  image: CharacterVisualImage,
  official: boolean,
): Promise<void> {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  selectingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.character.assets.setCharacterVisualAssetOfficial({
      fileName: image.fileName,
      official,
      taskId: record.id,
    });
    applyWorkspace(workspace);
    toast.success(official ? '已设为正式资产' : '已移出正式资产');
  } catch (selectionError: unknown) {
    toast.error(selectionError instanceof Error ? selectionError.message : String(selectionError));
  } finally {
    selectingFileName.value = '';
  }
}

function requestDelete(record: CharacterVisualAssetRecord, image: CharacterVisualImage): void {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  deleteTarget.value = { image, record };
  deleteDialogOpen.value = true;
}

function editImage(record: CharacterVisualAssetRecord, image: CharacterVisualImage): void {
  void router.push({
    name: 'image-editor',
    query: {
      fileName: image.name || record.name || image.fileName,
      mimeType: image.mimeType,
      returnTo: 'character-visual',
      sourceUrl: image.url,
    },
  });
}

async function deleteAsset(): Promise<void> {
  if (!deleteTarget.value || deletingFileName.value) {
    return;
  }
  const { image, record } = deleteTarget.value;
  deletingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.character.assets.deleteCharacterVisualAsset({
      fileName: image.fileName,
      taskId: record.id,
    });
    applyWorkspace(workspace);
    deleteDialogOpen.value = false;
    deleteTarget.value = null;
    toast.success('角色视觉图片已删除');
  } catch (deletionError: unknown) {
    toast.error(deletionError instanceof Error ? deletionError.message : String(deletionError));
  } finally {
    deletingFileName.value = '';
  }
}

function openUpload(): void {
  if (operationDisabled.value) {
    return;
  }
  closeGenerator();
  openUploadDialog();
}

async function handleUploaded(): Promise<void> {
  try {
    applyWorkspace(
      await window.desktop.character.assets.getCharacterVisualWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
    toast.success('角色视觉图片已上传');
  } catch (uploadError: unknown) {
    toast.error(uploadError instanceof Error ? uploadError.message : String(uploadError));
  }
}

// 页面初始化
async function initialize(): Promise<void> {
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    await characterLibraryStore.initialize();
    const [status, deepseek, minimax] = await Promise.all([
      window.desktop.settings.getCredentialStatus('apimart'),
      window.desktop.settings.getCredentialStatus('deepseek'),
      window.desktop.settings.getCredentialStatus('minimax'),
    ]);
    credentialStatus.value = status;
    deepseekStatus.value = deepseek;
    minimaxStatus.value = minimax;
    const requestedCharacterId =
      typeof route.query.characterId === 'string' ? route.query.characterId : '';
    const initialCharacterId =
      characterLibraryStore.characters.find(character => character.id === requestedCharacterId)
        ?.id ??
      characterLibraryStore.characters[0]?.id ??
      '';
    if (!initialCharacterId) {
      throw new Error('请先创建角色');
    }
    await window.desktop.character.library.selectCharacter({ characterId: initialCharacterId });
    selectedCharacterId.value = initialCharacterId;
    await loadCharacterWorkspace(initialCharacterId);
  } catch (initializationError: unknown) {
    errorMessage.value =
      initializationError instanceof Error
        ? initializationError.message
        : String(initializationError);
  } finally {
    isInitializing.value = false;
  }
}

onMounted(() => {
  void initialize();
});

onBeforeUnmount(() => {
  isDisposed = true;
  clearPollTimer();
});
</script>

<template>
  <SagPage title="角色视觉资产" description="基于正式视觉生成和管理角色动作" :icon="Camera">
    <template #header-leading>
      <Badge variant="secondary" class="shrink-0 tabular-nums">{{ assetCount }}</Badge>
    </template>

    <template #header-actions>
      <VisualPageHeader
        :characters="characters"
        :character-selection-disabled="characterSelectionDisabled"
        :generator-open="generatorOpen"
        :operation-disabled="operationDisabled"
        :selected-character-id="selectedCharacterId"
        @ai-create="openGenerator"
        @upload="openUpload"
        @update:selected-character-id="selectCharacter"
      />
    </template>

    <Alert
      v-if="!isInitializing && !hasOfficialReference"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
    >
      <AlertCircle class="size-4" />
      <AlertTitle>生成动作需要正式角色视觉</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>请先上传角色图片，或将图库中的一张图片设为正式资产。</span>
        <Button size="sm" variant="outline" @click="openUpload">上传角色视觉</Button>
      </AlertDescription>
    </Alert>

    <SagMissingPrerequisiteAlert
      v-if="!isInitializing && !keyConfigured"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
      title="生成图片需要 APIMart API Key"
      description="上传已有角色视觉图片不受影响。"
      action-label="前往设置"
      to="/settings"
    />

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 w-auto shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>角色动作生成暂时中断</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button v-if="activeRecord && !isPolling" size="sm" variant="outline" @click="retryPolling">
          继续查询
        </Button>
      </AlertDescription>
    </Alert>

    <div
      :class="[
        'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden',
        generatorOpen && 'lg:grid-cols-[minmax(0,5fr)_minmax(340px,2fr)]',
      ]"
    >
      <div class="flex min-h-0 min-w-0 lg:flex">
        <VisualGallery
          :deleting-file-name="deletingFileName"
          :official-assets="officialAssets"
          :polling-state="pollingState"
          :records="records"
          :renaming-file-name="renamingFileName"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
          @edit="editImage"
          @official="selectAsset"
          @rename="requestRename"
        />
      </div>
      <div v-if="generatorOpen" class="flex min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5">
        <CharacterActionGeneratorPanel
          v-model:action="action"
          v-model:count="count"
          v-model:name="imageName"
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="isBusy"
          :disabled="isGenerateDisabled"
          :prompt-generation-available="promptGenerationAvailable"
          :prompt-generating="isGeneratingPrompt"
          :reference-assets="selectedReferenceOptions"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeGenerator"
          @generate="generateActions"
          @generate-prompt="generateActionPrompt"
          @open-reference-picker="referenceDialogOpen = true"
        />
      </div>
    </div>

    <VisualUploadDialog
      v-model:open="uploadDialogOpen"
      :character-id="selectedCharacterId"
      @uploaded="handleUploaded"
    />

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="isSubmitting"
      description="只能选择当前角色的正式视觉。生成时将锁定角色外观，只改变姿势。"
      :filters="[]"
      :max-selection="1"
      :options="referenceOptions"
      :selected-keys="selectedReferenceKeys"
      title="选择正式角色视觉"
      @confirm="selectReferenceAsset"
    />

    <VisualAssetRenameDialog
      v-model:open="renameDialogOpen"
      :current-name="renameTarget?.image.name || renameTarget?.record.name || ''"
      :loading="Boolean(renamingFileName)"
      @rename="renameAsset"
    />

    <SagConfirmDialog
      v-model:open="deleteDialogOpen"
      :title="`删除“${deleteTarget?.image.name || deleteTarget?.record.name || '这张图片'}”？`"
      description="图片将从作品工作区永久删除，此操作不可恢复。"
      :confirm-text="deletingFileName ? '删除中' : '确定删除'"
      :loading="Boolean(deletingFileName)"
      @confirm="deleteAsset"
    />
  </SagPage>
</template>
