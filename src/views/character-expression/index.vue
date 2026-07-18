<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, Images, Laugh, SlidersHorizontal } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import type {
  CharacterExpressionRecord,
  CharacterExpressionSize,
  CharacterExpressionWorkspaceState,
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitWorkspaceState,
  CredentialStatus,
  SaveFileRequest,
  SavedFileResult,
} from '@/types';
import ExpressionGallery from './components/expression-gallery.vue';
import ExpressionGeneratorPanel from './components/expression-generator-panel.vue';
import ExpressionRenameDialog from './components/expression-rename-dialog.vue';
import ExpressionUploadDialog from './components/expression-upload-dialog.vue';

const router = useRouter();
const records = ref<CharacterExpressionRecord[]>([]);
const portraitWorkspace = ref<CharacterPortraitWorkspaceState | null>(null);
const credentialStatus = ref<CredentialStatus | null>(null);
const name = ref('开心');
const description = ref('眼睛明亮，嘴角自然上扬，带有真诚而有感染力的笑意。');
const size = ref<CharacterExpressionSize>('1:1');
const resolution = ref<CharacterPortraitResolution>('2k');
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
const mobilePane = ref<'settings' | 'gallery'>('settings');

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;

const activeStatuses = ['submitted', 'pending', 'processing'];
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const selectedPortraitImage = computed(() =>
  findSelectedImage(
    portraitWorkspace.value?.records ?? [],
    portraitWorkspace.value?.selectedImage ?? null,
  ),
);
const selectedSheetImage = computed(() =>
  findSelectedImage(
    portraitWorkspace.value?.sheetRecords ?? [],
    portraitWorkspace.value?.selectedSheet ?? null,
  ),
);
const hasReferences = computed(
  () => Boolean(selectedPortraitImage.value) && Boolean(selectedSheetImage.value),
);
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !keyConfigured.value ||
    !hasReferences.value ||
    !name.value.trim() ||
    name.value.length > 80 ||
    !description.value.trim() ||
    description.value.length > 20_000,
);

function findSelectedImage(
  recordList: CharacterPortraitWorkspaceState['records'],
  selection: CharacterPortraitSelection | null,
): CharacterPortraitImage | null;
function findSelectedImage(
  recordList: CharacterPortraitWorkspaceState['sheetRecords'],
  selection: CharacterPortraitSelection | null,
): CharacterPortraitImage | null;
function findSelectedImage(
  recordList:
    | CharacterPortraitWorkspaceState['records']
    | CharacterPortraitWorkspaceState['sheetRecords'],
  selection: CharacterPortraitSelection | null,
): CharacterPortraitImage | null {
  if (!selection) {
    return null;
  }
  return (
    recordList
      .find(record => record.id === selection.taskId)
      ?.images.find(image => image.fileName === selection.fileName) ?? null
  );
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

function schedulePoll(taskId: string): void {
  clearPollTimer();
  pollTimer = setTimeout(() => {
    void pollExpressionTask(taskId);
  }, 2500);
}

async function pollExpressionTask(taskId: string): Promise<void> {
  if (isDisposed) {
    return;
  }
  isPolling.value = true;
  try {
    const record = await window.desktop.getCharacterExpressionTask(taskId);
    replaceRecord(record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll(taskId);
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
    isPolling.value = false;
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  }
}

async function initialize(): Promise<void> {
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    const [expressionWorkspace, currentPortraitWorkspace, status] = await Promise.all([
      window.desktop.getCharacterExpressionWorkspace(),
      window.desktop.getCharacterPortraitWorkspace(),
      window.desktop.getCredentialStatus('apimart'),
    ]);
    applyWorkspace(expressionWorkspace);
    portraitWorkspace.value = currentPortraitWorkspace;
    credentialStatus.value = status;

    const latestGeneratedRecord = expressionWorkspace.records.find(
      record => record.source === 'generated',
    );
    if (latestGeneratedRecord) {
      name.value = latestGeneratedRecord.name;
      description.value = latestGeneratedRecord.description;
      size.value = latestGeneratedRecord.size;
      resolution.value = latestGeneratedRecord.resolution;
      count.value = latestGeneratedRecord.count;
    }

    const unfinishedRecord = expressionWorkspace.records.find(record =>
      activeStatuses.includes(record.status),
    );
    if (unfinishedRecord) {
      mobilePane.value = 'gallery';
      schedulePoll(unfinishedRecord.id);
    }
  } catch (initializationError: unknown) {
    errorMessage.value =
      initializationError instanceof Error
        ? initializationError.message
        : String(initializationError);
  } finally {
    isInitializing.value = false;
  }
}

async function generateExpression(): Promise<void> {
  if (isGenerateDisabled.value) {
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const record = await window.desktop.generateCharacterExpression({
      count: count.value,
      description: description.value.trim(),
      name: name.value.trim(),
      resolution: resolution.value,
      size: size.value,
    });
    replaceRecord(record);
    mobilePane.value = 'gallery';
    await pollExpressionTask(record.id);
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
  void pollExpressionTask(activeRecord.value.id);
}

function uploadExpression(
  expressionName: string,
  request: SaveFileRequest,
): Promise<SavedFileResult> {
  return window.desktop.uploadCharacterExpression({ ...request, name: expressionName });
}

async function handleUploaded(): Promise<void> {
  try {
    applyWorkspace(await window.desktop.getCharacterExpressionWorkspace());
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
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <Laugh class="size-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">表情管理</h1>
            <Badge variant="outline" class="hidden sm:inline-flex">GPT-Image-2</Badge>
          </div>
          <p class="truncate text-xs text-muted-foreground">基于正式角色资产生成与管理表情</p>
        </div>
      </div>

      <div class="flex items-center gap-1 lg:hidden">
        <Button
          size="icon"
          :variant="mobilePane === 'settings' ? 'secondary' : 'ghost'"
          aria-label="显示设置"
          @click="mobilePane = 'settings'"
        >
          <SlidersHorizontal class="size-4" />
        </Button>
        <Button
          size="icon"
          :variant="mobilePane === 'gallery' ? 'secondary' : 'ghost'"
          aria-label="显示表情"
          @click="mobilePane = 'gallery'"
        >
          <Images class="size-4" />
        </Button>
      </div>
    </template>

    <Alert v-if="!isInitializing && !hasReferences" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>生成表情需要正式定妆照和正式角色表</AlertTitle>
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
      class="grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(340px,2fr)_minmax(0,5fr)]"
    >
      <div
        :class="['min-h-0 min-w-0 lg:flex', mobilePane === 'settings' ? 'flex' : 'hidden lg:flex']"
      >
        <ExpressionGeneratorPanel
          v-model:count="count"
          v-model:description="description"
          v-model:name="name"
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="isBusy"
          :disabled="isGenerateDisabled"
          :reference-portrait="selectedPortraitImage"
          :reference-sheet="selectedSheetImage"
          class="min-h-0 min-w-0 flex-1"
          @generate="generateExpression"
          @upload="uploadDialogOpen = true"
        />
      </div>

      <div
        :class="['min-h-0 min-w-0 lg:flex', mobilePane === 'gallery' ? 'flex' : 'hidden lg:flex']"
      >
        <ExpressionGallery
          :deleting-file-name="deletingFileName"
          :records="records"
          :renaming-task-id="renamingTaskId"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
          @rename="requestRename"
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
