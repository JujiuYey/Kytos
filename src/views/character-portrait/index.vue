<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CharacterAssetUploadDialog } from '@/components/sag/character-asset-upload-dialog';
import { CharacterSheetGeneratorPanel } from '@/components/sag/character-sheet-generator-panel';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import type {
  CharacterDraft,
  CharacterImageRecord,
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitSize,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  CredentialStatus,
  SaveFileRequest,
  SavedFileResult,
} from '@/types';
import { createEmptyCharacterDraft } from '@/types';
import PortraitGallery from './components/portrait-gallery.vue';
import PortraitPageHeader from './components/portrait-page-header.vue';
import PortraitGeneratorPanel from './components/portrait-generator-panel.vue';

type AssetKind = 'portrait' | 'sheet';
type WorkspaceStage = 'portrait' | 'sheet';

const router = useRouter();
const draft = ref<CharacterDraft>(createEmptyCharacterDraft());
const credentialStatus = ref<CredentialStatus | null>(null);
const records = ref<CharacterPortraitRecord[]>([]);
const sheetRecords = ref<CharacterSheetRecord[]>([]);
const selectedImage = ref<CharacterPortraitSelection | null>(null);
const selectedSheet = ref<CharacterPortraitSelection | null>(null);
const prompt = ref('');
const sheetPrompt = ref('');
const size = ref<CharacterPortraitSize>('2:3');
const resolution = ref<CharacterPortraitResolution>('2k');
const sheetResolution = ref<CharacterPortraitResolution>('2k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isSubmittingSheet = ref(false);
const isPolling = ref(false);
const isPollingSheet = ref(false);
const selectingFileName = ref('');
const deletingFileName = ref('');
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{
  image: CharacterPortraitImage;
  kind: AssetKind;
  record: CharacterImageRecord;
} | null>(null);
const uploadDialogOpen = ref(false);
const uploadKind = ref<AssetKind>('portrait');
const activeStage = ref<WorkspaceStage>('portrait');
const generatorOpen = ref(true);
const mobilePane = ref<'settings' | 'gallery'>('settings');

let portraitPollTimer: ReturnType<typeof setTimeout> | null = null;
let sheetPollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;

const activeStatuses = ['submitted', 'pending', 'processing'];
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const activeSheetRecord = computed(() =>
  sheetRecords.value.find(record => activeStatuses.includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const isSheetBusy = computed(() => isSubmittingSheet.value || Boolean(activeSheetRecord.value));
const selectedPortraitImage = computed(() => findSelectedImage(records.value, selectedImage.value));
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !keyConfigured.value ||
    !prompt.value.trim() ||
    prompt.value.length > 20_000,
);
const isSheetGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isSheetBusy.value ||
    !keyConfigured.value ||
    !selectedPortraitImage.value ||
    !sheetPrompt.value.trim() ||
    sheetPrompt.value.length > 20_000,
);
const currentPollingRecord = computed(() =>
  activeStage.value === 'portrait' ? activeRecord.value : activeSheetRecord.value,
);
const currentIsPolling = computed(() =>
  activeStage.value === 'portrait' ? isPolling.value : isPollingSheet.value,
);
const uploadTitle = computed(() =>
  uploadKind.value === 'portrait' ? '上传已有定妆照' : '上传已有角色表',
);
const uploadDescription = computed(() =>
  uploadKind.value === 'portrait'
    ? '上传后将直接设为正式定妆照，并可继续生成多角度角色表。'
    : '上传后将直接设为正式角色表，不再调用图片生成服务。',
);
const uploadHandler = computed(() =>
  uploadKind.value === 'portrait' ? uploadPortrait : uploadSheet,
);

function buildPortraitPrompt(character: CharacterDraft): string {
  const characterDetails = [
    character.name && `角色姓名：${character.name}`,
    character.concept && `核心概念：${character.concept}`,
    character.appearance && `外形设定：${character.appearance}`,
    character.personality && `性格气质：${character.personality}`,
    character.visualDirection && `视觉方向：${character.visualDirection}`,
  ].filter((item): item is string => Boolean(item));

  return [
    '为以下原创角色绘制一张专业定妆照。',
    ...characterDetails,
    '画面要求：单一角色，全身正面站立，自然中性姿态，完整展示头部、发型、五官、服装、鞋履与标志性配饰；人物居中，比例准确，轮廓清晰，服装材质和细节可辨识。',
    '背景要求：干净的浅灰色摄影棚背景，柔和均匀布光，不使用复杂场景。',
    '禁止：裁切人物、多人、多视角拼贴、设定表排版、文字、标注、Logo、水印。',
  ].join('\n');
}

function buildSheetPrompt(): string {
  return [
    '参考图中的角色就是唯一要画的人，必须保持同一个角色，不要重新设计或美化。',
    '严格保持参考图中的脸、五官、神态、发型、身材比例、服装、鞋履、配饰、颜色和绘画风格一致。',
    '生成一张 16:9 横版多角度角色设定表，人物之间留出清晰间距并对齐。',
    '从左到右依次展示：正面全身、完全侧面全身、背面全身、放大的四分之三侧面头肩像。',
    '全身视图保持相同身高和自然中性站姿，完整展示头部到鞋底；头像清楚展示五官、表情、发型与标志性配饰。',
    '背景干净统一，不要地面线、阴影、边框、文字、标注、色卡、额外人物或额外物品。',
  ].join('\n');
}

function findSelectedImage<TRecord extends CharacterImageRecord>(
  recordList: TRecord[],
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

function replaceRecord<TRecord extends CharacterImageRecord>(
  recordList: TRecord[],
  updatedRecord: TRecord,
): TRecord[] {
  return [updatedRecord, ...recordList.filter(record => record.id !== updatedRecord.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function applyWorkspace(workspace: CharacterPortraitWorkspaceState) {
  records.value = workspace.records;
  sheetRecords.value = workspace.sheetRecords;
  selectedImage.value = workspace.selectedImage;
  selectedSheet.value = workspace.selectedSheet;
}

function clearPollTimer(kind: AssetKind) {
  if (kind === 'portrait' && portraitPollTimer) {
    clearTimeout(portraitPollTimer);
    portraitPollTimer = null;
  }
  if (kind === 'sheet' && sheetPollTimer) {
    clearTimeout(sheetPollTimer);
    sheetPollTimer = null;
  }
}

function schedulePoll(kind: AssetKind, taskId: string) {
  clearPollTimer(kind);
  const timer = setTimeout(() => {
    if (kind === 'portrait') {
      void pollPortraitTask(taskId);
    } else {
      void pollSheetTask(taskId);
    }
  }, 2500);
  if (kind === 'portrait') {
    portraitPollTimer = timer;
  } else {
    sheetPollTimer = timer;
  }
}

async function pollPortraitTask(taskId: string) {
  if (isDisposed) {
    return;
  }
  isPolling.value = true;
  try {
    const record = await window.desktop.getCharacterPortraitTask(taskId);
    records.value = replaceRecord(records.value, record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll('portrait', taskId);
      return;
    }
    isPolling.value = false;
    if (record.status === 'completed') {
      toast.success('定妆照已生成并保存到工作区');
      mobilePane.value = 'gallery';
    } else {
      errorMessage.value = record.errorMessage || '定妆照生成任务未完成';
    }
  } catch (pollError: unknown) {
    isPolling.value = false;
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  }
}

async function pollSheetTask(taskId: string) {
  if (isDisposed) {
    return;
  }
  isPollingSheet.value = true;
  try {
    const record = await window.desktop.getCharacterSheetTask(taskId);
    sheetRecords.value = replaceRecord(sheetRecords.value, record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll('sheet', taskId);
      return;
    }
    isPollingSheet.value = false;
    if (record.status === 'completed') {
      toast.success('多角度角色表已生成并保存到工作区');
      mobilePane.value = 'gallery';
    } else {
      errorMessage.value = record.errorMessage || '角色表生成任务未完成';
    }
  } catch (pollError: unknown) {
    isPollingSheet.value = false;
    errorMessage.value = pollError instanceof Error ? pollError.message : String(pollError);
  }
}

async function initialize() {
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    const [characterWorkspace, portraitWorkspace, status] = await Promise.all([
      window.desktop.getCharacterWorkspace(),
      window.desktop.getCharacterPortraitWorkspace(),
      window.desktop.getCredentialStatus('apimart'),
    ]);
    draft.value = characterWorkspace.draft;
    applyWorkspace(portraitWorkspace);
    credentialStatus.value = status;

    const latestGeneratedRecord = portraitWorkspace.records.find(
      record => record.source === 'generated',
    );
    prompt.value = latestGeneratedRecord?.prompt || buildPortraitPrompt(characterWorkspace.draft);
    if (latestGeneratedRecord) {
      size.value = latestGeneratedRecord.size;
      resolution.value = latestGeneratedRecord.resolution;
      count.value = latestGeneratedRecord.count;
    }

    const latestGeneratedSheet = portraitWorkspace.sheetRecords.find(
      record => record.source === 'generated',
    );
    sheetPrompt.value = latestGeneratedSheet?.prompt || buildSheetPrompt();
    sheetResolution.value = latestGeneratedSheet?.resolution || '2k';

    const unfinishedRecord = portraitWorkspace.records.find(record =>
      activeStatuses.includes(record.status),
    );
    const unfinishedSheet = portraitWorkspace.sheetRecords.find(record =>
      activeStatuses.includes(record.status),
    );
    if (unfinishedRecord) {
      schedulePoll('portrait', unfinishedRecord.id);
    }
    if (unfinishedSheet) {
      activeStage.value = 'sheet';
      schedulePoll('sheet', unfinishedSheet.id);
    }
    if (unfinishedRecord || unfinishedSheet) {
      mobilePane.value = 'gallery';
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

async function generatePortraits() {
  if (isGenerateDisabled.value) {
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const record = await window.desktop.generateCharacterPortrait({
      count: count.value,
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

async function generateSheet() {
  if (isSheetGenerateDisabled.value) {
    return;
  }
  isSubmittingSheet.value = true;
  errorMessage.value = '';
  try {
    const record = await window.desktop.generateCharacterSheet({
      prompt: sheetPrompt.value.trim(),
      resolution: sheetResolution.value,
    });
    sheetRecords.value = replaceRecord(sheetRecords.value, record);
    mobilePane.value = 'gallery';
    await pollSheetTask(record.id);
  } catch (generationError: unknown) {
    errorMessage.value =
      generationError instanceof Error ? generationError.message : String(generationError);
  } finally {
    isSubmittingSheet.value = false;
  }
}

function retryPolling() {
  if (!currentPollingRecord.value || currentIsPolling.value) {
    return;
  }
  errorMessage.value = '';
  if (activeStage.value === 'portrait') {
    void pollPortraitTask(currentPollingRecord.value.id);
  } else {
    void pollSheetTask(currentPollingRecord.value.id);
  }
}

function closeGenerator(): void {
  generatorOpen.value = false;
  mobilePane.value = 'gallery';
}

function openGenerator(): void {
  generatorOpen.value = true;
  mobilePane.value = 'settings';
}

async function selectPortrait(record: CharacterImageRecord, image: CharacterPortraitImage) {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  selectingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.selectCharacterPortrait({
      fileName: image.fileName,
      taskId: record.id,
    });
    applyWorkspace(workspace);
    activeStage.value = 'sheet';
    mobilePane.value = 'settings';
    toast.success('已设为正式定妆照');
  } catch (selectionError: unknown) {
    toast.error(selectionError instanceof Error ? selectionError.message : String(selectionError));
  } finally {
    selectingFileName.value = '';
  }
}

async function selectSheet(record: CharacterImageRecord, image: CharacterPortraitImage) {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  selectingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.selectCharacterSheet({
      fileName: image.fileName,
      taskId: record.id,
    });
    applyWorkspace(workspace);
    toast.success('已设为正式角色表');
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
        ? await window.desktop.deleteCharacterPortrait(request)
        : await window.desktop.deleteCharacterSheet(request);
    applyWorkspace(workspace);
    deleteDialogOpen.value = false;
    deleteTarget.value = null;
    toast.success(kind === 'portrait' ? '定妆照已删除' : '角色表已删除');
  } catch (deletionError: unknown) {
    toast.error(deletionError instanceof Error ? deletionError.message : String(deletionError));
  } finally {
    deletingFileName.value = '';
  }
}

function openUpload(kind: AssetKind) {
  uploadKind.value = kind;
  uploadDialogOpen.value = true;
}

function uploadPortrait(request: SaveFileRequest): Promise<SavedFileResult> {
  return window.desktop.uploadCharacterPortrait(request);
}

function uploadSheet(request: SaveFileRequest): Promise<SavedFileResult> {
  return window.desktop.uploadCharacterSheet(request);
}

async function handleUploaded() {
  try {
    applyWorkspace(await window.desktop.getCharacterPortraitWorkspace());
    if (uploadKind.value === 'portrait') {
      activeStage.value = 'sheet';
      mobilePane.value = 'settings';
      toast.success('定妆照已上传并设为正式定妆照');
    } else {
      activeStage.value = 'sheet';
      mobilePane.value = 'gallery';
      toast.success('角色表已上传并设为正式角色表');
    }
  } catch (uploadError: unknown) {
    toast.error(uploadError instanceof Error ? uploadError.message : String(uploadError));
  }
}

onMounted(() => {
  void initialize();
});

onBeforeUnmount(() => {
  isDisposed = true;
  clearPollTimer('portrait');
  clearPollTimer('sheet');
});
</script>

<template>
  <SagPage>
    <template #header>
      <PortraitPageHeader
        v-model:active-stage="activeStage"
        v-model:mobile-pane="mobilePane"
        :generator-open="generatorOpen"
        :selected-image="selectedImage"
        :selected-sheet="selectedSheet"
        @ai-create="openGenerator"
      />
    </template>

    <Alert v-if="!isInitializing && !keyConfigured" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>生成图片需要 APIMart API Key</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>上传已有定妆照或角色表不受影响。</span>
        <Button size="sm" variant="outline" @click="router.push('/settings')">前往设置</Button>
      </AlertDescription>
    </Alert>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>角色图片流程暂时中断</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ errorMessage }}</span>
        <Button
          v-if="currentPollingRecord && !currentIsPolling"
          size="sm"
          variant="outline"
          @click="retryPolling"
        >
          继续查询
        </Button>
      </AlertDescription>
    </Alert>

    <div
      v-if="activeStage === 'portrait'"
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
        <PortraitGallery
          asset-kind="portrait"
          :deleting-file-name="deletingFileName"
          :records="records"
          :selected-image="selectedImage"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="(record, image) => requestDelete('portrait', record, image)"
          @select="selectPortrait"
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
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="isBusy"
          :disabled="isGenerateDisabled"
          :draft="draft"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeGenerator"
          @generate="generatePortraits"
          @upload="openUpload('portrait')"
        />
      </div>
    </div>

    <div
      v-else
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
        <PortraitGallery
          asset-kind="sheet"
          :deleting-file-name="deletingFileName"
          :records="sheetRecords"
          :selected-image="selectedSheet"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="(record, image) => requestDelete('sheet', record, image)"
          @select="selectSheet"
        />
      </div>
      <div
        v-if="generatorOpen"
        :class="[
          'min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5',
          mobilePane === 'settings' ? 'flex' : 'hidden lg:flex',
        ]"
      >
        <CharacterSheetGeneratorPanel
          v-model="sheetPrompt"
          v-model:resolution="sheetResolution"
          :busy="isSheetBusy"
          :disabled="isSheetGenerateDisabled"
          :reference-image="selectedPortraitImage"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeGenerator"
          @generate="generateSheet"
          @upload="openUpload('sheet')"
        />
      </div>
    </div>

    <CharacterAssetUploadDialog
      v-model:open="uploadDialogOpen"
      :description="uploadDescription"
      :title="uploadTitle"
      :upload-handler="uploadHandler"
      @uploaded="handleUploaded"
    />

    <SagConfirmDialog
      v-model:open="deleteDialogOpen"
      :title="deleteTarget?.kind === 'sheet' ? '删除这张角色表？' : '删除这张定妆照？'"
      description="图片将从作品工作区永久删除，此操作不可恢复。"
      :confirm-text="deletingFileName ? '删除中' : '确定删除'"
      :loading="Boolean(deletingFileName)"
      @confirm="deleteAsset"
    />
  </SagPage>
</template>
