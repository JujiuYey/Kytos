<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle, Camera, SlidersHorizontal } from 'lucide-vue-next';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import type {
  CharacterDraft,
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterPortraitSize,
  CredentialStatus,
} from '@/types';
import { createEmptyCharacterDraft } from '@/types';
import PortraitGallery from './components/portrait-gallery.vue';
import PortraitGeneratorPanel from './components/portrait-generator-panel.vue';

const router = useRouter();
const draft = ref<CharacterDraft>(createEmptyCharacterDraft());
const credentialStatus = ref<CredentialStatus | null>(null);
const records = ref<CharacterPortraitRecord[]>([]);
const selectedImage = ref<CharacterPortraitSelection | null>(null);
const prompt = ref('');
const size = ref<CharacterPortraitSize>('2:3');
const resolution = ref<CharacterPortraitResolution>('2k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isPolling = ref(false);
const selectingFileName = ref('');
const deletingFileName = ref('');
const deleteDialogOpen = ref(false);
const deleteTarget = ref<{
  image: CharacterPortraitImage;
  record: CharacterPortraitRecord;
} | null>(null);
const mobilePane = ref<'settings' | 'gallery'>('settings');

let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isDisposed = false;

const activeRecord = computed(() =>
  records.value.find(record => ['submitted', 'pending', 'processing'].includes(record.status)),
);
const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));
const isBusy = computed(() => isSubmitting.value || Boolean(activeRecord.value));
const isGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !keyConfigured.value ||
    !prompt.value.trim() ||
    prompt.value.length > 20_000,
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

function replaceRecord(updatedRecord: CharacterPortraitRecord) {
  records.value = [
    updatedRecord,
    ...records.value.filter(record => record.id !== updatedRecord.id),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function clearPollTimer() {
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(taskId: string) {
  clearPollTimer();
  pollTimer = setTimeout(() => {
    void pollTask(taskId);
  }, 2500);
}

async function pollTask(taskId: string) {
  if (isDisposed) {
    return;
  }
  isPolling.value = true;
  try {
    const record = await window.desktop.getCharacterPortraitTask(taskId);
    replaceRecord(record);
    errorMessage.value = '';

    if (['submitted', 'pending', 'processing'].includes(record.status)) {
      schedulePoll(taskId);
      return;
    }

    isPolling.value = false;
    if (record.status === 'completed') {
      toast.success('定妆照已生成并保存到工作区');
      mobilePane.value = 'gallery';
    } else {
      errorMessage.value = record.errorMessage || '图片生成任务未完成';
    }
  } catch (pollError: unknown) {
    isPolling.value = false;
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
    records.value = portraitWorkspace.records;
    selectedImage.value = portraitWorkspace.selectedImage;
    credentialStatus.value = status;

    const latestRecord = portraitWorkspace.records[0];
    prompt.value = latestRecord?.prompt || buildPortraitPrompt(characterWorkspace.draft);
    if (latestRecord) {
      size.value = latestRecord.size;
      resolution.value = latestRecord.resolution;
      count.value = latestRecord.count;
    }

    const unfinishedRecord = portraitWorkspace.records.find(record =>
      ['submitted', 'pending', 'processing'].includes(record.status),
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
    replaceRecord(record);
    mobilePane.value = 'gallery';
    await pollTask(record.id);
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
  void pollTask(activeRecord.value.id);
}

async function selectPortrait(record: CharacterPortraitRecord, image: CharacterPortraitImage) {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  selectingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.selectCharacterPortrait({
      fileName: image.fileName,
      taskId: record.id,
    });
    selectedImage.value = workspace.selectedImage;
    toast.success('已设为角色定妆照');
  } catch (selectionError: unknown) {
    toast.error(selectionError instanceof Error ? selectionError.message : String(selectionError));
  } finally {
    selectingFileName.value = '';
  }
}

function requestDeletePortrait(record: CharacterPortraitRecord, image: CharacterPortraitImage) {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  deleteTarget.value = { image, record };
  deleteDialogOpen.value = true;
}

async function deletePortrait() {
  if (!deleteTarget.value || deletingFileName.value) {
    return;
  }

  const { image, record } = deleteTarget.value;
  deletingFileName.value = image.fileName;
  try {
    const workspace = await window.desktop.deleteCharacterPortrait({
      fileName: image.fileName,
      taskId: record.id,
    });
    records.value = workspace.records;
    selectedImage.value = workspace.selectedImage;
    deleteDialogOpen.value = false;
    deleteTarget.value = null;
    toast.success('定妆照已删除');
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
  <main class="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <header class="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 sm:px-5">
      <div class="flex min-w-0 items-center gap-3">
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <Camera class="size-4" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">角色定妆照</h1>
            <Badge variant="outline" class="hidden sm:inline-flex">GPT-Image-2</Badge>
          </div>
          <p class="truncate text-xs text-muted-foreground">根据角色档案生成并选定标准视觉形象</p>
        </div>
      </div>

      <div class="flex items-center gap-2 lg:hidden">
        <Button
          size="sm"
          :variant="mobilePane === 'settings' ? 'secondary' : 'ghost'"
          @click="mobilePane = 'settings'"
        >
          <SlidersHorizontal class="size-4" />
          设置
        </Button>
        <Button
          size="sm"
          :variant="mobilePane === 'gallery' ? 'secondary' : 'ghost'"
          @click="mobilePane = 'gallery'"
        >
          <Camera class="size-4" />
          候选
        </Button>
      </div>
    </header>

    <Alert v-if="!isInitializing && !keyConfigured" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>需要 APIMart API Key</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>配置完成后才能调用 GPT-Image-2 生成定妆照。</span>
        <Button size="sm" variant="outline" @click="router.push('/settings')">前往设置</Button>
      </AlertDescription>
    </Alert>

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>定妆照流程暂时中断</AlertTitle>
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
        <PortraitGeneratorPanel
          v-model="prompt"
          v-model:count="count"
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="isBusy"
          :disabled="isGenerateDisabled"
          :draft="draft"
          class="min-h-0 min-w-0 flex-1"
          @generate="generatePortraits"
        />
      </div>
      <div
        :class="['min-h-0 min-w-0 lg:flex', mobilePane === 'gallery' ? 'flex' : 'hidden lg:flex']"
      >
        <PortraitGallery
          :deleting-file-name="deletingFileName"
          :records="records"
          :selected-image="selectedImage"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDeletePortrait"
          @select="selectPortrait"
        />
      </div>
    </div>

    <SagConfirmDialog
      v-model:open="deleteDialogOpen"
      title="删除这张定妆照？"
      description="图片将从作品工作区永久删除，此操作不可恢复。"
      :confirm-text="deletingFileName ? '删除中' : '确定删除'"
      :loading="Boolean(deletingFileName)"
      @confirm="deletePortrait"
    />
  </main>
</template>
