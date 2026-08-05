<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, Camera } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CharacterAssetUploadDialog } from '@/components/sag/character-asset-upload-dialog';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import {
  ImageReferencePickerDialog,
  type ImageReferencePickerOption,
} from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagMissingPrerequisiteAlert } from '@/components/sag/missing-prerequisite-alert';
import { SagPage } from '@/components/sag/sag-page';
import { useAppStore } from '@/stores/app';
import type {
  CharacterLibraryState,
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualAssetUpload,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualSize,
  CharacterVisualWorkspaceState,
  CredentialStatus,
  SavedFileResult,
} from '@/types';
import { getChatModelDefinition, MAX_CHARACTER_ACTION_LENGTH } from '@/types';
import CharacterActionGeneratorPanel from './components/character-action-generator-panel.vue';
import VisualGallery from './components/visual-gallery.vue';
import VisualPageHeader from './components/visual-page-header.vue';
import VisualAssetRenameDialog from './components/visual-asset-rename-dialog.vue';

interface ActionReferenceOption extends ImageReferencePickerOption {
  selection: CharacterVisualAssetSelection;
}

const appStore = useAppStore();
const router = useRouter();
const library = ref<CharacterLibraryState | null>(null);
const selectedCharacterId = ref('');
const credentialStatus = ref<CredentialStatus | null>(null);
const deepseekStatus = ref<CredentialStatus | null>(null);
const minimaxStatus = ref<CredentialStatus | null>(null);
const records = ref<CharacterVisualAssetRecord[]>([]);
const officialAssets = ref<CharacterVisualAssetSelection[]>([]);
const action = ref('自然站立，抬起右手挥手，左手自然垂下。');
const imageName = ref('挥手');
const size = ref<CharacterVisualSize>('2:3');
const resolution = ref<CharacterVisualResolution>('1k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isPolling = ref(false);
const isGeneratingPrompt = ref(false);
const pollingState = ref<GenerationTaskPollingState>({ attempt: 0, phase: 'idle', taskId: '' });
const selectingFileName = ref('');
const renamingFileName = ref('');
const deletingFileName = ref('');
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{
  image: CharacterVisualImage;
  record: CharacterVisualAssetRecord;
} | null>(null);
const uploadDialogOpen = ref(false);
const referenceDialogOpen = ref(false);
const renameDialogOpen = ref(false);
const renameTarget = ref<{
  image: CharacterVisualImage;
  record: CharacterVisualAssetRecord;
} | null>(null);
const generatorOpen = ref(false);
const mobilePane = ref<'settings' | 'gallery'>('gallery');
const selectedReferenceAsset = ref<CharacterVisualAssetSelection | null>(null);

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;
let loadRequestId = 0;

const activeStatuses = ['submitted', 'pending', 'processing'];
const characters = computed(() => library.value?.characters ?? []);
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const fastModelProvider = computed(
  () => getChatModelDefinition(appStore.settings.fastModel).provider,
);
const promptGenerationAvailable = computed(() =>
  fastModelProvider.value === 'minimax'
    ? Boolean(minimaxStatus.value?.configured)
    : Boolean(deepseekStatus.value?.configured),
);
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
const assetCount = computed(() =>
  records.value.reduce((total, record) => total + record.images.length, 0),
);
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
const uploadTitle = '上传角色视觉图片';
const uploadDescription = '填写图片名称后上传。上传完成后可按需要设为正式资产。';

function referenceAssetKey(selection: CharacterVisualAssetSelection): string {
  return `${selection.taskId}:${selection.fileName}`;
}

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
) {
  officialAssets.value = workspace.officialAssets;
  records.value = workspace.records;
  syncSelectedReference(preferredReference);
}

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function resetPollingState(): void {
  pollingState.value = { attempt: 0, phase: 'idle', taskId: '' };
}

function schedulePoll(taskId: string) {
  clearPollTimer();
  pollingState.value = {
    attempt: pollingState.value.taskId === taskId ? pollingState.value.attempt : 0,
    phase: 'waiting',
    taskId,
  };
  pollTimer = setTimeout(() => {
    void pollVisualTask(taskId);
  }, 2500);
}

async function pollVisualTask(taskId: string) {
  if (isDisposed) {
    return;
  }
  isPolling.value = true;
  pollingState.value = {
    attempt: pollingState.value.taskId === taskId ? pollingState.value.attempt + 1 : 1,
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
      mobilePane.value = 'gallery';
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
    mobilePane.value = 'gallery';
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

async function initialize(): Promise<void> {
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    const [characterLibrary, status, deepseek, minimax] = await Promise.all([
      window.desktop.character.library.getCharacterLibrary(),
      window.desktop.settings.getCredentialStatus('apimart'),
      window.desktop.settings.getCredentialStatus('deepseek'),
      window.desktop.settings.getCredentialStatus('minimax'),
    ]);
    library.value = characterLibrary;
    credentialStatus.value = status;
    deepseekStatus.value = deepseek;
    minimaxStatus.value = minimax;
    selectedCharacterId.value = characterLibrary.activeCharacterId;
    await loadCharacterWorkspace(characterLibrary.activeCharacterId);
  } catch (initializationError: unknown) {
    errorMessage.value =
      initializationError instanceof Error
        ? initializationError.message
        : String(initializationError);
  } finally {
    isInitializing.value = false;
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
    library.value = await window.desktop.character.library.selectCharacter({ characterId });
    selectedCharacterId.value = characterId;
    await loadCharacterWorkspace(characterId);
  } catch (selectionError: unknown) {
    errorMessage.value =
      selectionError instanceof Error ? selectionError.message : String(selectionError);
    isInitializing.value = false;
  }
}

async function generateActions() {
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
    mobilePane.value = 'gallery';
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

function retryPolling() {
  if (!activeRecord.value || isPolling.value) {
    return;
  }
  errorMessage.value = '';
  void pollVisualTask(activeRecord.value.id);
}

function closeGenerator(): void {
  generatorOpen.value = false;
  mobilePane.value = 'gallery';
}

function openGenerator(): void {
  if (operationDisabled.value) {
    return;
  }
  generatorOpen.value = true;
  mobilePane.value = 'settings';
  void refreshVisualWorkspace();
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

async function selectAsset(
  record: CharacterVisualAssetRecord,
  image: CharacterVisualImage,
  official: boolean,
) {
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

function requestDelete(record: CharacterVisualAssetRecord, image: CharacterVisualImage) {
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

async function deleteAsset() {
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

function openUpload() {
  if (operationDisabled.value) {
    return;
  }
  generatorOpen.value = false;
  mobilePane.value = 'gallery';
  uploadDialogOpen.value = true;
}

function uploadVisualAsset(request: CharacterVisualAssetUpload): Promise<SavedFileResult> {
  if (!selectedCharacterId.value) {
    return Promise.reject(new Error('请先选择角色'));
  }
  return window.desktop.character.assets.uploadCharacterVisualAsset({
    ...request,
    characterId: selectedCharacterId.value,
  });
}

async function handleUploaded() {
  try {
    applyWorkspace(
      await window.desktop.character.assets.getCharacterVisualWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
    mobilePane.value = 'gallery';
    toast.success('角色视觉图片已上传');
  } catch (uploadError: unknown) {
    toast.error(uploadError instanceof Error ? uploadError.message : String(uploadError));
  }
}

function requestRename(record: CharacterVisualAssetRecord, image: CharacterVisualImage): void {
  if (renamingFileName.value || selectingFileName.value || deletingFileName.value) {
    return;
  }
  renameTarget.value = { image, record };
  renameDialogOpen.value = true;
}

async function renameAsset(name: string): Promise<void> {
  const target = renameTarget.value;
  if (!target || renamingFileName.value) {
    return;
  }
  renamingFileName.value = target.image.fileName;
  try {
    applyWorkspace(
      await window.desktop.character.assets.renameCharacterVisualAsset({
        fileName: target.image.fileName,
        name,
        taskId: target.record.id,
      }),
    );
    renameDialogOpen.value = false;
    renameTarget.value = null;
    toast.success('图片名称已更新');
  } catch (renameError: unknown) {
    toast.error(renameError instanceof Error ? renameError.message : String(renameError));
  } finally {
    renamingFileName.value = '';
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
        v-model:mobile-pane="mobilePane"
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
      <div
        :class="[
          'min-h-0 min-w-0 lg:flex',
          !generatorOpen || mobilePane === 'gallery' ? 'flex' : 'hidden lg:flex',
        ]"
      >
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
      <div
        v-if="generatorOpen"
        :class="[
          'min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5',
          mobilePane === 'settings' ? 'flex' : 'hidden lg:flex',
        ]"
      >
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

    <CharacterAssetUploadDialog
      v-model:open="uploadDialogOpen"
      :description="uploadDescription"
      :title="uploadTitle"
      :upload-handler="uploadVisualAsset"
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
