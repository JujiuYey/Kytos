<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { AlertCircle } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharacterAssetUploadDialog } from '@/components/sag/character-asset-upload-dialog';
import { CharacterPortraitWorkflow } from '@/components/sag/character-portrait-workflow';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagMissingPrerequisiteAlert } from '@/components/sag/missing-prerequisite-alert';
import { SagPage } from '@/components/sag/sag-page';
import type {
  CharacterDraft,
  CharacterImageRecord,
  CharacterLibraryState,
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitResolution,
  CharacterPortraitSize,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  CharacterVisualAssetSelection,
  CredentialStatus,
  SavedFileResult,
  UploadCharacterVisualAssetRequest,
} from '@/types';
import { createEmptyCharacterDraft } from '@/types';
import PortraitGallery from './components/portrait-gallery.vue';
import PortraitPageHeader from './components/portrait-page-header.vue';
import PortraitGeneratorPanel from './components/portrait-generator-panel.vue';
import VisualAssetRenameDialog from './components/visual-asset-rename-dialog.vue';

type AssetKind = 'portrait' | 'sheet';
type CreationTarget = 'portrait' | 'sheet';
type WorkspaceMode = 'cards' | 'canvas';

const library = ref<CharacterLibraryState | null>(null);
const selectedCharacterId = ref('');
const draft = ref<CharacterDraft>(createEmptyCharacterDraft());
const credentialStatus = ref<CredentialStatus | null>(null);
const records = ref<CharacterPortraitRecord[]>([]);
const sheetRecords = ref<CharacterSheetRecord[]>([]);
const officialAssets = ref<CharacterVisualAssetSelection[]>([]);
const prompt = ref('');
const imageName = ref('定妆照');
const size = ref<CharacterPortraitSize>('2:3');
const resolution = ref<CharacterPortraitResolution>('1k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isPolling = ref(false);
const pollingState = ref<GenerationTaskPollingState>({ attempt: 0, phase: 'idle', taskId: '' });
const selectingFileName = ref('');
const renamingFileName = ref('');
const deletingFileName = ref('');
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{
  image: CharacterPortraitImage;
  kind: AssetKind;
  record: CharacterImageRecord;
} | null>(null);
const uploadDialogOpen = ref(false);
const renameDialogOpen = ref(false);
const renameTarget = ref<{
  image: CharacterPortraitImage;
  kind: AssetKind;
  record: CharacterImageRecord;
} | null>(null);
const generatorOpen = ref(true);
const workspaceMode = ref<WorkspaceMode>('cards');
const mobilePane = ref<'settings' | 'gallery'>('settings');

let portraitPollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;
let loadRequestId = 0;

const activeStatuses = ['submitted', 'pending', 'processing'];
const characters = computed(() => library.value?.characters ?? []);
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const characterSelectionDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    workspaceMode.value === 'canvas' ||
    Boolean(selectingFileName.value) ||
    Boolean(renamingFileName.value) ||
    Boolean(deletingFileName.value),
);
const operationDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !selectedCharacterId.value ||
    Boolean(selectingFileName.value) ||
    Boolean(renamingFileName.value) ||
    Boolean(deletingFileName.value),
);
const assetCount = computed(
  () =>
    records.value.reduce((total, record) => total + record.images.length, 0) +
    sheetRecords.value.reduce((total, record) => total + record.images.length, 0),
);
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !selectedCharacterId.value ||
    !keyConfigured.value ||
    !imageName.value.trim() ||
    imageName.value.length > 80 ||
    !prompt.value.trim() ||
    prompt.value.length > 20_000,
);
const uploadTitle = '上传角色视觉图片';
const uploadDescription = '填写图片名称后上传。上传完成后可按需要设为正式资产。';

function buildPortraitPrompt(character: CharacterDraft): string {
  const characterDetails = [
    character.name && `角色姓名：${character.name}`,
    character.visualSummary && `视觉总述：${character.visualSummary}`,
    character.ageAndBuild && `年龄与体态：${character.ageAndBuild}`,
    character.faceAnchor && `脸部锚点：${character.faceAnchor}`,
    character.hairAnchor && `发型锚点：${character.hairAnchor}`,
    character.defaultOutfit && `默认服装：${character.defaultOutfit}`,
    character.characterPalette && `角色配色：${character.characterPalette}`,
    character.signatureItems && `标志物：${character.signatureItems}`,
    character.silhouetteMarkers && `轮廓识别点：${character.silhouetteMarkers}`,
    character.visualMedium && `表现形式：${character.visualMedium}`,
    character.lineAndShape && `线条与造型：${character.lineAndShape}`,
    character.colorRules && `色彩规则：${character.colorRules}`,
    character.detailDensity && `细节密度：${character.detailDensity}`,
    character.backgroundRules && `背景规则：${character.backgroundRules}`,
    character.textRules && `文字规则：${character.textRules}`,
    character.exclusions && `排除项：${character.exclusions}`,
  ].filter((item): item is string => Boolean(item));

  return [
    '根据以下已经确认的角色视觉定义绘制一张专业定妆照。',
    ...characterDetails,
    '严格保持已经确认的人物形象锚点，不要根据性格、动机或故事背景重新推断和设计长相。',
    '画面要求：单一角色，全身正面站立，自然中性姿态，完整展示头部到鞋底；人物居中，比例准确，轮廓清晰。遵循已经确认的默认服装、角色配色和视觉表现规则。',
    '禁止：裁切人物、多人、多视角拼贴、设定表排版、文字、标注、Logo、水印。',
  ].join('\n');
}

function replaceRecord<TRecord extends CharacterImageRecord>(
  recordList: TRecord[],
  updatedRecord: TRecord,
): TRecord[] {
  return [updatedRecord, ...recordList.filter(record => record.id !== updatedRecord.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function applyWorkspace(workspace: CharacterPortraitWorkspaceState) {
  officialAssets.value = workspace.officialAssets;
  records.value = workspace.records;
  sheetRecords.value = workspace.sheetRecords;
}

function clearPollTimer() {
  if (portraitPollTimer) {
    clearTimeout(portraitPollTimer);
    portraitPollTimer = null;
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
  portraitPollTimer = setTimeout(() => {
    void pollPortraitTask(taskId);
  }, 2500);
}

async function pollPortraitTask(taskId: string) {
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
    const record = await window.desktop.character.portrait.getCharacterPortraitTask(taskId);
    records.value = replaceRecord(records.value, record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll(taskId);
      return;
    }
    resetPollingState();
    if (record.status === 'completed') {
      toast.success(`“${record.name}”已生成并保存到工作区`);
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

function applyCharacterWorkspace(
  characterDraft: CharacterDraft,
  portraitWorkspace: CharacterPortraitWorkspaceState,
): void {
  draft.value = characterDraft;
  applyWorkspace(portraitWorkspace);

  const latestGeneratedRecord = portraitWorkspace.records.find(
    record => record.source === 'generated',
  );
  prompt.value = buildPortraitPrompt(characterDraft);
  imageName.value = latestGeneratedRecord?.name || '定妆照';
  size.value = latestGeneratedRecord?.size ?? '2:3';
  resolution.value = latestGeneratedRecord?.resolution ?? '1k';
  count.value = latestGeneratedRecord?.count ?? 2;

  const unfinishedRecord = portraitWorkspace.records.find(record =>
    activeStatuses.includes(record.status),
  );
  const unfinishedSheet = portraitWorkspace.sheetRecords.find(record =>
    activeStatuses.includes(record.status),
  );
  if (unfinishedRecord) {
    schedulePoll(unfinishedRecord.id);
  }
  if (unfinishedSheet) {
    workspaceMode.value = 'canvas';
    generatorOpen.value = false;
  }
  if (unfinishedRecord || unfinishedSheet) {
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
  sheetRecords.value = [];
  officialAssets.value = [];
  try {
    const [characterWorkspace, portraitWorkspace] = await Promise.all([
      window.desktop.character.portrait.getCharacterWorkspace(),
      window.desktop.character.portrait.getCharacterPortraitWorkspace({ characterId }),
    ]);
    if (requestId !== loadRequestId || selectedCharacterId.value !== characterId) {
      return;
    }
    applyCharacterWorkspace(characterWorkspace.draft, portraitWorkspace);
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
    const [characterLibrary, status] = await Promise.all([
      window.desktop.character.library.getCharacterLibrary(),
      window.desktop.settings.getCredentialStatus('apimart'),
    ]);
    library.value = characterLibrary;
    credentialStatus.value = status;
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

async function generatePortraits() {
  if (isGenerateDisabled.value) {
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const record = await window.desktop.character.portrait.generateCharacterPortrait({
      count: count.value,
      name: imageName.value.trim(),
      prompt: prompt.value.trim(),
      resolution: resolution.value,
      size: size.value,
    });
    records.value = replaceRecord(records.value, record);
    mobilePane.value = 'gallery';
    await pollPortraitTask(record.id);
  } catch (generationError: unknown) {
    errorMessage.value =
      generationError instanceof Error ? generationError.message : String(generationError);
  } finally {
    isSubmitting.value = false;
  }
}

function retryPolling() {
  if (!activeRecord.value || isPolling.value) {
    return;
  }
  errorMessage.value = '';
  void pollPortraitTask(activeRecord.value.id);
}

function closeGenerator(): void {
  generatorOpen.value = false;
  mobilePane.value = 'gallery';
}

function openGenerator(stage: CreationTarget): void {
  if (operationDisabled.value) {
    return;
  }
  if (stage === 'sheet') {
    workspaceMode.value = 'canvas';
    generatorOpen.value = false;
    return;
  }
  workspaceMode.value = 'cards';
  generatorOpen.value = true;
  mobilePane.value = 'settings';
  void refreshPortraitWorkspace();
}

async function refreshPortraitWorkspace(): Promise<void> {
  try {
    applyWorkspace(
      await window.desktop.character.portrait.getCharacterPortraitWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
  } catch (refreshError: unknown) {
    errorMessage.value =
      refreshError instanceof Error ? refreshError.message : String(refreshError);
  }
}

async function selectAsset(
  kind: AssetKind,
  record: CharacterImageRecord,
  image: CharacterPortraitImage,
  official: boolean,
) {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  selectingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.character.portrait.setCharacterVisualAssetOfficial({
      fileName: image.fileName,
      kind,
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

function requestDelete(
  kind: AssetKind,
  record: CharacterImageRecord,
  image: CharacterPortraitImage,
) {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  deleteTarget.value = { image, kind, record };
  deleteDialogOpen.value = true;
}

async function deleteAsset() {
  if (!deleteTarget.value || deletingFileName.value) {
    return;
  }
  const { image, kind, record } = deleteTarget.value;
  deletingFileName.value = image.fileName;
  try {
    const request = { fileName: image.fileName, taskId: record.id };
    const workspace =
      kind === 'portrait'
        ? await window.desktop.character.portrait.deleteCharacterPortrait(request)
        : await window.desktop.character.portrait.deleteCharacterSheet(request);
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
  uploadDialogOpen.value = true;
}

function uploadVisualAsset(request: UploadCharacterVisualAssetRequest): Promise<SavedFileResult> {
  if (!selectedCharacterId.value) {
    return Promise.reject(new Error('请先选择角色'));
  }
  return window.desktop.character.portrait.uploadCharacterVisualAsset(request);
}

async function handleUploaded() {
  try {
    applyWorkspace(
      await window.desktop.character.portrait.getCharacterPortraitWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
    mobilePane.value = 'gallery';
    toast.success('角色视觉图片已上传');
  } catch (uploadError: unknown) {
    toast.error(uploadError instanceof Error ? uploadError.message : String(uploadError));
  }
}

function requestRename(
  kind: AssetKind,
  record: CharacterImageRecord,
  image: CharacterPortraitImage,
): void {
  if (renamingFileName.value || selectingFileName.value || deletingFileName.value) {
    return;
  }
  renameTarget.value = { image, kind, record };
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
      await window.desktop.character.portrait.renameCharacterVisualAsset({
        fileName: target.image.fileName,
        kind: target.kind,
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
  <SagPage>
    <template #header>
      <PortraitPageHeader
        v-model:mobile-pane="mobilePane"
        :characters="characters"
        :character-selection-disabled="characterSelectionDisabled"
        :asset-count="assetCount"
        :canvas-open="workspaceMode === 'canvas'"
        :card-open="workspaceMode === 'cards' && generatorOpen"
        :operation-disabled="operationDisabled"
        :selected-character-id="selectedCharacterId"
        @ai-create="openGenerator"
        @upload="openUpload"
        @update:selected-character-id="selectCharacter"
      />
    </template>

    <SagMissingPrerequisiteAlert
      v-if="!isInitializing && !keyConfigured"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
      title="生成图片需要 APIMart API Key"
      description="上传已有角色视觉图片不受影响。"
      action-label="前往设置"
      to="/settings"
    />

    <Alert
      v-if="workspaceMode === 'cards' && errorMessage"
      variant="destructive"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
    >
      <AlertCircle class="size-4" />
      <AlertTitle>角色图片流程暂时中断</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button v-if="activeRecord && !isPolling" size="sm" variant="outline" @click="retryPolling">
          继续查询
        </Button>
      </AlertDescription>
    </Alert>

    <CharacterPortraitWorkflow
      v-if="workspaceMode === 'canvas'"
      class="min-h-0 min-w-0 flex-1"
      @workspace-updated="refreshPortraitWorkspace"
    />

    <div
      v-else
      :class="[
        'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden',
        generatorOpen && 'lg:grid-cols-[minmax(0,9fr)_minmax(340px,4fr)]',
      ]"
    >
      <div
        :class="[
          'min-h-0 min-w-0 lg:flex',
          !generatorOpen || mobilePane === 'gallery' ? 'flex' : 'hidden lg:flex',
        ]"
      >
        <PortraitGallery
          :deleting-file-name="deletingFileName"
          :official-assets="officialAssets"
          :polling-state="pollingState"
          :portrait-records="records"
          :renaming-file-name="renamingFileName"
          :selecting-file-name="selectingFileName"
          :sheet-records="sheetRecords"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
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
        <PortraitGeneratorPanel
          v-model="prompt"
          v-model:count="count"
          v-model:name="imageName"
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="isBusy"
          :disabled="isGenerateDisabled"
          :draft="draft"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeGenerator"
          @generate="generatePortraits"
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
