<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import type {
  CharacterExpressionRecord,
  CharacterExpressionSize,
  CharacterExpressionWorkspaceState,
  CharacterLibraryState,
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitWorkspaceState,
  CharacterVisualAssetSelection,
  CredentialStatus,
  SaveFileRequest,
  SavedFileResult,
} from '@/types';
import { MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES } from '@/types';
import ExpressionGallery from './components/expression-gallery.vue';
import ExpressionGeneratorPanel from './components/expression-generator-panel.vue';
import ExpressionPageHeader from './components/expression-page-header.vue';
import ExpressionRenameDialog from './components/expression-rename-dialog.vue';
import ExpressionUploadDialog from './components/expression-upload-dialog.vue';

const router = useRouter();
const library = ref<CharacterLibraryState | null>(null);
const selectedCharacterId = ref('');
const records = ref<CharacterExpressionRecord[]>([]);
const portraitWorkspace = ref<CharacterPortraitWorkspaceState | null>(null);
const selectedReferenceAssets = ref<CharacterVisualAssetSelection[]>([]);
const credentialStatus = ref<CredentialStatus | null>(null);
const name = ref('开心');
const description = ref('眼睛明亮，嘴角自然上扬，带有真诚而有感染力的笑意。');
const size = ref<CharacterExpressionSize>('1:1');
const resolution = ref<CharacterPortraitResolution>('1k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isPolling = ref(false);
const deletingFileName = ref('');
const renamingTaskId = ref('');
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{
  image: CharacterPortraitImage;
  record: CharacterExpressionRecord;
} | null>(null);
const renameDialogOpen = ref(false);
const renameTarget = ref<CharacterExpressionRecord | null>(null);
const uploadDialogOpen = ref(false);
const generatorOpen = ref(false);
const mobilePane = ref<'settings' | 'gallery'>('gallery');

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;
let loadRequestId = 0;

const activeStatuses = ['submitted', 'pending', 'processing'];
const defaultExpressionName = '开心';
const defaultExpressionDescription = '眼睛明亮，嘴角自然上扬，带有真诚而有感染力的笑意。';
const characters = computed(() => library.value?.characters ?? []);
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const characterSelectionDisabled = computed(
  () =>
    isInitializing.value ||
    isSubmitting.value ||
    Boolean(deletingFileName.value) ||
    Boolean(renamingTaskId.value),
);
const officialReferenceAssets = computed(() =>
  (portraitWorkspace.value?.officialAssets ?? []).flatMap(selection => {
    const image = findOfficialImage(selection);
    return image ? [{ image, key: referenceAssetKey(selection), selection: { ...selection } }] : [];
  }),
);
const selectedReferenceKeys = computed(() => selectedReferenceAssets.value.map(referenceAssetKey));
const hasReferences = computed(() => Boolean(portraitWorkspace.value?.officialAssets.length));
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !keyConfigured.value ||
    !hasReferences.value ||
    selectedReferenceAssets.value.length < 1 ||
    selectedReferenceAssets.value.length > MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES ||
    !name.value.trim() ||
    name.value.length > 80 ||
    !description.value.trim() ||
    description.value.length > 20_000,
);

function referenceAssetKey(selection: CharacterVisualAssetSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

function findOfficialImage(
  selection: CharacterVisualAssetSelection,
): CharacterPortraitImage | null {
  const workspace = portraitWorkspace.value;
  if (!workspace || !selection) {
    return null;
  }
  const records = selection.kind === 'portrait' ? workspace.records : workspace.sheetRecords;
  return (
    records
      .find(record => record.id === selection.taskId)
      ?.images.find(image => image.fileName === selection.fileName) ?? null
  );
}

function toggleReferenceAsset(selection: CharacterVisualAssetSelection): void {
  const key = referenceAssetKey(selection);
  if (selectedReferenceAssets.value.some(asset => referenceAssetKey(asset) === key)) {
    selectedReferenceAssets.value = selectedReferenceAssets.value.filter(
      asset => referenceAssetKey(asset) !== key,
    );
    return;
  }
  if (selectedReferenceAssets.value.length >= MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES) {
    return;
  }
  selectedReferenceAssets.value = [
    ...selectedReferenceAssets.value,
    { fileName: selection.fileName, kind: selection.kind, taskId: selection.taskId },
  ];
}

function replaceRecord(updatedRecord: CharacterExpressionRecord): void {
  records.value = [
    updatedRecord,
    ...records.value.filter(record => record.id !== updatedRecord.id),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function applyWorkspace(workspace: CharacterExpressionWorkspaceState): void {
  records.value = workspace.records;
}

function clearPollTimer(): void {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(taskId: string, characterId: string): void {
  clearPollTimer();
  pollTimer = setTimeout(() => {
    void pollExpressionTask(taskId, characterId);
  }, 2500);
}

async function pollExpressionTask(taskId: string, characterId: string): Promise<void> {
  if (isDisposed || selectedCharacterId.value !== characterId) {
    return;
  }
  isPolling.value = true;
  try {
    const record = await window.desktop.getCharacterExpressionTask({ characterId, taskId });
    if (selectedCharacterId.value !== characterId) {
      return;
    }
    replaceRecord(record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll(taskId, characterId);
      return;
    }
    isPolling.value = false;
    if (record.status === 'completed') {
      toast.success(`“${record.name}”表情已生成并保存到工作区`);
      mobilePane.value = 'gallery';
    } else {
      errorMessage.value = record.errorMessage || '表情生成任务未完成';
    }
  } catch (pollError: unknown) {
    if (selectedCharacterId.value !== characterId) {
      return;
    }
    isPolling.value = false;
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  }
}

function applyCharacterWorkspace(
  expressionWorkspace: CharacterExpressionWorkspaceState,
  currentPortraitWorkspace: CharacterPortraitWorkspaceState,
): void {
  applyWorkspace(expressionWorkspace);
  portraitWorkspace.value = currentPortraitWorkspace;
  selectedReferenceAssets.value = [];

  const latestGeneratedRecord = expressionWorkspace.records.find(
    record => record.source === 'generated',
  );
  name.value = latestGeneratedRecord?.name ?? defaultExpressionName;
  description.value = latestGeneratedRecord?.description ?? defaultExpressionDescription;
  size.value = latestGeneratedRecord?.size ?? '1:1';
  resolution.value = latestGeneratedRecord?.resolution ?? '1k';
  count.value = latestGeneratedRecord?.count ?? 2;

  const unfinishedRecord = expressionWorkspace.records.find(record =>
    activeStatuses.includes(record.status),
  );
  if (unfinishedRecord) {
    generatorOpen.value = true;
    mobilePane.value = 'gallery';
    schedulePoll(unfinishedRecord.id, selectedCharacterId.value);
  }
}

async function loadCharacterWorkspace(characterId: string): Promise<void> {
  const requestId = ++loadRequestId;
  clearPollTimer();
  isPolling.value = false;
  isInitializing.value = true;
  errorMessage.value = '';
  records.value = [];
  portraitWorkspace.value = null;
  selectedReferenceAssets.value = [];
  try {
    const [expressionWorkspace, currentPortraitWorkspace] = await Promise.all([
      window.desktop.getCharacterExpressionWorkspace({ characterId }),
      window.desktop.getCharacterPortraitWorkspace({ characterId }),
    ]);
    if (requestId !== loadRequestId || selectedCharacterId.value !== characterId) {
      return;
    }
    applyCharacterWorkspace(expressionWorkspace, currentPortraitWorkspace);
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
      window.desktop.getCharacterLibrary(),
      window.desktop.getCredentialStatus('apimart'),
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
    isInitializing.value = false;
  }
}

function selectCharacter(characterId: string): void {
  if (
    characterSelectionDisabled.value ||
    characterId === selectedCharacterId.value ||
    !characters.value.some(character => character.id === characterId)
  ) {
    return;
  }
  selectedCharacterId.value = characterId;
  selectedReferenceAssets.value = [];
  void loadCharacterWorkspace(characterId);
}

async function generateExpression(): Promise<void> {
  const characterId = selectedCharacterId.value;
  if (isGenerateDisabled.value || !characterId) {
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const record = await window.desktop.generateCharacterExpression({
      characterId,
      count: count.value,
      description: description.value.trim(),
      name: name.value.trim(),
      referenceAssets: selectedReferenceAssets.value.map(asset => ({
        fileName: asset.fileName,
        kind: asset.kind,
        taskId: asset.taskId,
      })),
      resolution: resolution.value,
      size: size.value,
    });
    replaceRecord(record);
    mobilePane.value = 'gallery';
    await pollExpressionTask(record.id, characterId);
  } catch (generationError: unknown) {
    errorMessage.value =
      generationError instanceof Error ? generationError.message : String(generationError);
  } finally {
    isSubmitting.value = false;
  }
}

function retryPolling(): void {
  if (!activeRecord.value || isPolling.value) {
    return;
  }
  errorMessage.value = '';
  void pollExpressionTask(activeRecord.value.id, selectedCharacterId.value);
}

function closeGenerator(): void {
  generatorOpen.value = false;
  mobilePane.value = 'gallery';
}

function uploadExpression(
  expressionName: string,
  request: SaveFileRequest,
): Promise<SavedFileResult> {
  return window.desktop.uploadCharacterExpression({
    ...request,
    characterId: selectedCharacterId.value,
    name: expressionName,
  });
}

async function handleUploaded(): Promise<void> {
  try {
    applyWorkspace(
      await window.desktop.getCharacterExpressionWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
    mobilePane.value = 'gallery';
    toast.success('表情已上传并保存到工作区');
  } catch (uploadError: unknown) {
    toast.error(uploadError instanceof Error ? uploadError.message : String(uploadError));
  }
}

function requestDelete(record: CharacterExpressionRecord, image: CharacterPortraitImage): void {
  if (deletingFileName.value || renamingTaskId.value) {
    return;
  }
  deleteTarget.value = { image, record };
  deleteDialogOpen.value = true;
}

function requestRename(record: CharacterExpressionRecord): void {
  if (deletingFileName.value || renamingTaskId.value) {
    return;
  }
  renameTarget.value = record;
  renameDialogOpen.value = true;
}

async function renameExpression(nextName: string): Promise<void> {
  if (!renameTarget.value || renamingTaskId.value) {
    return;
  }
  renamingTaskId.value = renameTarget.value.id;
  try {
    applyWorkspace(
      await window.desktop.renameCharacterExpression({
        characterId: selectedCharacterId.value,
        name: nextName,
        taskId: renameTarget.value.id,
      }),
    );
    renameDialogOpen.value = false;
    renameTarget.value = null;
    toast.success('表情名称已更新');
  } catch (renameError: unknown) {
    toast.error(renameError instanceof Error ? renameError.message : String(renameError));
  } finally {
    renamingTaskId.value = '';
  }
}

async function deleteExpression(): Promise<void> {
  if (!deleteTarget.value || deletingFileName.value) {
    return;
  }
  const { image, record } = deleteTarget.value;
  deletingFileName.value = image.fileName;
  try {
    applyWorkspace(
      await window.desktop.deleteCharacterExpression({
        characterId: selectedCharacterId.value,
        fileName: image.fileName,
        taskId: record.id,
      }),
    );
    deleteDialogOpen.value = false;
    deleteTarget.value = null;
    toast.success('表情已删除');
  } catch (deletionError: unknown) {
    toast.error(deletionError instanceof Error ? deletionError.message : String(deletionError));
  } finally {
    deletingFileName.value = '';
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
      <ExpressionPageHeader
        v-model:mobile-pane="mobilePane"
        :generator-open="generatorOpen"
        @ai-create="
          generatorOpen = true;
          mobilePane = 'settings';
        "
        @upload="
          uploadDialogOpen = true;
          generatorOpen = false;
          mobilePane = 'gallery';
        "
      />
    </template>

    <Alert v-if="!isInitializing && !hasReferences" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>生成表情需要正式角色视觉</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>上传已有表情不受影响。</span>
        <Button size="sm" variant="outline" @click="router.push('/character-portrait')">
          前往角色视觉
        </Button>
      </AlertDescription>
    </Alert>

    <Alert v-if="!isInitializing && !keyConfigured" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>生成图片需要 APIMart API Key</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>上传已有表情不受影响。</span>
        <Button size="sm" variant="outline" @click="router.push('/settings')">前往设置</Button>
      </AlertDescription>
    </Alert>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>表情流程暂时中断</AlertTitle>
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
        <ExpressionGallery
          :characters="characters"
          :character-selection-disabled="characterSelectionDisabled"
          :deleting-file-name="deletingFileName"
          :records="records"
          :renaming-task-id="renamingTaskId"
          :selected-character-id="selectedCharacterId"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
          @rename="requestRename"
          @update:selected-character-id="selectCharacter"
        />
      </div>

      <div
        v-if="generatorOpen"
        :class="[
          'min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5',
          mobilePane === 'settings' ? 'flex' : 'hidden lg:flex',
        ]"
      >
        <ExpressionGeneratorPanel
          v-model:count="count"
          v-model:description="description"
          v-model:name="name"
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="isBusy"
          :disabled="isGenerateDisabled"
          :reference-assets="officialReferenceAssets"
          :selected-reference-keys="selectedReferenceKeys"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeGenerator"
          @generate="generateExpression"
          @toggle-reference="toggleReferenceAsset"
        />
      </div>
    </div>

    <ExpressionUploadDialog
      v-model:open="uploadDialogOpen"
      :upload-handler="uploadExpression"
      @uploaded="handleUploaded"
    />

    <ExpressionRenameDialog
      v-model:open="renameDialogOpen"
      :current-name="renameTarget?.name || ''"
      :loading="Boolean(renamingTaskId)"
      @rename="renameExpression"
    />

    <SagConfirmDialog
      v-model:open="deleteDialogOpen"
      title="删除这张表情？"
      description="图片将从作品工作区永久删除，此操作不可恢复。"
      :confirm-text="deletingFileName ? '删除中' : '确定删除'"
      :loading="Boolean(deletingFileName)"
      @confirm="deleteExpression"
    />
  </SagPage>
</template>
