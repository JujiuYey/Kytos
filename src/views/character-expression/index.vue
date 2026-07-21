<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import { ImageReferencePickerDialog } from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import { useAppStore } from '@/stores/app';
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
  CharacterExpressionSize,
  CharacterExpressionWorkspaceState,
  CharacterLibraryState,
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitWorkspaceState,
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
import type { ExpressionReferenceOption } from './expression-reference';

const router = useRouter();
const appStore = useAppStore();
const library = ref<CharacterLibraryState | null>(null);
const selectedCharacterId = ref('');
const records = ref<CharacterExpressionRecord[]>([]);
const portraitWorkspace = ref<CharacterPortraitWorkspaceState | null>(null);
const selectedReferenceAssets = ref<CharacterExpressionReferenceSelection[]>([]);
const credentialStatus = ref<CredentialStatus | null>(null);
const deepseekStatus = ref<CredentialStatus | null>(null);
const name = ref('开心');
const description = ref('眼睛明亮，嘴角自然上扬，带有真诚而有感染力的笑意。');
const size = ref<CharacterExpressionSize>('1:1');
const resolution = ref<CharacterPortraitResolution>('1k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isPolling = ref(false);
const pollingState = ref<GenerationTaskPollingState>({ attempt: 0, phase: 'idle', taskId: '' });
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
const referenceDialogOpen = ref(false);
const generatorOpen = ref(false);
const isGeneratingPrompt = ref(false);
const mobilePane = ref<'settings' | 'gallery'>('gallery');

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;
let loadRequestId = 0;

const activeStatuses = ['submitted', 'pending', 'processing'];
const defaultExpressionName = '开心';
const defaultExpressionDescription = '眼睛明亮，嘴角自然上扬，带有真诚而有感染力的笑意。';
const referenceFilters = [
  { label: '视觉资产', value: 'visual' },
  { label: '已有表情', value: 'expression' },
];
const characters = computed(() => library.value?.characters ?? []);
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const promptGenerationAvailable = computed(() => Boolean(deepseekStatus.value?.configured));
const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const characterSelectionDisabled = computed(
  () =>
    isInitializing.value ||
    isSubmitting.value ||
    isGeneratingPrompt.value ||
    Boolean(deletingFileName.value) ||
    Boolean(renamingTaskId.value),
);
const referenceOptions = computed<ExpressionReferenceOption[]>(() => {
  const workspace = portraitWorkspace.value;
  if (!workspace) {
    return [];
  }
  const portraitOptions = workspace.records.flatMap(record =>
    record.status === 'completed'
      ? record.images.map(image => {
          const selection = {
            fileName: image.fileName,
            kind: 'portrait' as const,
            taskId: record.id,
          };
          return {
            detail: `角色图片 · ${record.size}`,
            image,
            key: referenceAssetKey(selection),
            label: image.name || record.name || '角色图片',
            selection,
            source: 'visual' as const,
          };
        })
      : [],
  );
  const sheetOptions = workspace.sheetRecords.flatMap(record =>
    record.status === 'completed'
      ? record.images.map(image => {
          const selection = {
            fileName: image.fileName,
            kind: 'sheet' as const,
            taskId: record.id,
          };
          return {
            detail: '角色表 · 16:9',
            image,
            key: referenceAssetKey(selection),
            label: image.name || record.name || '角色表',
            selection,
            source: 'visual' as const,
          };
        })
      : [],
  );
  const expressionOptions = records.value.flatMap(record =>
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
            key: referenceAssetKey(selection),
            label: record.images.length > 1 ? `${record.name} ${index + 1}` : record.name,
            selection,
            source: 'expression' as const,
          };
        })
      : [],
  );
  return [...portraitOptions, ...sheetOptions, ...expressionOptions];
});
const selectedReferenceKeys = computed(() => selectedReferenceAssets.value.map(referenceAssetKey));
const selectedReferenceOptions = computed(() => {
  const selectedKeySet = new Set(selectedReferenceKeys.value);
  return referenceOptions.value.filter(option => selectedKeySet.has(option.key));
});
const hasReferences = computed(() => referenceOptions.value.length > 0);
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    isGeneratingPrompt.value ||
    !keyConfigured.value ||
    !hasReferences.value ||
    selectedReferenceOptions.value.length < 1 ||
    selectedReferenceOptions.value.length > MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES ||
    !name.value.trim() ||
    name.value.length > 80 ||
    !description.value.trim() ||
    description.value.length > 20_000,
);

function referenceAssetKey(selection: CharacterExpressionReferenceSelection): string {
  return `${selection.kind}:${selection.taskId}:${selection.fileName}`;
}

function selectReferenceAssets(keys: string[]): void {
  const selectedKeySet = new Set(keys);
  selectedReferenceAssets.value = referenceOptions.value
    .filter(option => selectedKeySet.has(option.key))
    .map(option => ({
      fileName: option.selection.fileName,
      kind: option.selection.kind,
      taskId: option.selection.taskId,
    }));
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

function resetPollingState(): void {
  pollingState.value = { attempt: 0, phase: 'idle', taskId: '' };
}

function schedulePoll(taskId: string, characterId: string): void {
  clearPollTimer();
  pollingState.value = {
    attempt: pollingState.value.taskId === taskId ? pollingState.value.attempt : 0,
    phase: 'waiting',
    taskId,
  };
  pollTimer = setTimeout(() => {
    void pollExpressionTask(taskId, characterId);
  }, 2500);
}

async function pollExpressionTask(taskId: string, characterId: string): Promise<void> {
  if (isDisposed || selectedCharacterId.value !== characterId) {
    return;
  }
  isPolling.value = true;
  pollingState.value = {
    attempt: pollingState.value.taskId === taskId ? pollingState.value.attempt + 1 : 1,
    phase: 'requesting',
    taskId,
  };
  try {
    const record = await window.desktop.character.expression.getCharacterExpressionTask({ characterId, taskId });
    if (selectedCharacterId.value !== characterId) {
      return;
    }
    replaceRecord(record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll(taskId, characterId);
      return;
    }
    resetPollingState();
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
    pollingState.value = { ...pollingState.value, phase: 'paused' };
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  } finally {
    isPolling.value = false;
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
  resetPollingState();
  isPolling.value = false;
  isInitializing.value = true;
  errorMessage.value = '';
  records.value = [];
  portraitWorkspace.value = null;
  selectedReferenceAssets.value = [];
  try {
    const [expressionWorkspace, currentPortraitWorkspace] = await Promise.all([
      window.desktop.character.expression.getCharacterExpressionWorkspace({ characterId }),
      window.desktop.character.portrait.getCharacterPortraitWorkspace({ characterId }),
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
    const [characterLibrary, status, deepseek] = await Promise.all([
      window.desktop.character.library.getCharacterLibrary(),
      window.desktop.settings.getCredentialStatus('apimart'),
      window.desktop.settings.getCredentialStatus('deepseek'),
    ]);
    library.value = characterLibrary;
    credentialStatus.value = status;
    deepseekStatus.value = deepseek;
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
    const record = await window.desktop.character.expression.generateCharacterExpression({
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

async function generateExpressionPrompt(): Promise<void> {
  if (isGeneratingPrompt.value || !promptGenerationAvailable.value || !name.value.trim()) {
    return;
  }
  isGeneratingPrompt.value = true;
  try {
    description.value = await window.desktop.character.expression.generateCharacterExpressionPrompt({
      model: appStore.settings.deepseekModel,
      name: name.value.trim(),
    });
    toast.success('表情提示词已生成');
  } catch (promptError: unknown) {
    toast.error(promptError instanceof Error ? promptError.message : String(promptError));
  } finally {
    isGeneratingPrompt.value = false;
  }
}

function uploadExpression(
  expressionName: string,
  request: SaveFileRequest,
): Promise<SavedFileResult> {
  return window.desktop.character.expression.uploadCharacterExpression({
    ...request,
    characterId: selectedCharacterId.value,
    name: expressionName,
  });
}

async function handleUploaded(): Promise<void> {
  try {
    applyWorkspace(
      await window.desktop.character.expression.getCharacterExpressionWorkspace({
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
      await window.desktop.character.expression.renameCharacterExpression({
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
      await window.desktop.character.expression.deleteCharacterExpression({
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
      <AlertTitle>生成表情需要角色参考</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>可以先准备角色视觉，或上传一张已有表情。</span>
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
          :polling-state="pollingState"
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
          :prompt-generation-available="promptGenerationAvailable"
          :prompt-generating="isGeneratingPrompt"
          :reference-assets="selectedReferenceOptions"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeGenerator"
          @generate="generateExpression"
          @generate-prompt="generateExpressionPrompt"
          @open-reference-picker="referenceDialogOpen = true"
        />
      </div>
    </div>

    <ExpressionUploadDialog
      v-model:open="uploadDialogOpen"
      :upload-handler="uploadExpression"
      @uploaded="handleUploaded"
    />

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="isSubmitting"
      description="可以混选当前角色的视觉资产和已有表情，生成时只使用这里确认的图片。"
      :filters="referenceFilters"
      :max-selection="MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES"
      :options="referenceOptions"
      :selected-keys="selectedReferenceKeys"
      title="选择角色参考"
      @confirm="selectReferenceAssets"
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
