<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { AlertCircle, Camera, PanelsTopLeft } from '@lucide/vue';
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
import { characterAnchorApi } from '@/lib/character-anchor-api';
import { useAppStore } from '@/stores/app';
import { useCharacterLibraryStore } from '@/stores/character-library';
import type {
  CharacterAnchorRecord,
  CharacterAnchorBinding,
  CharacterAnchorSelection,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualSize,
  CharacterAnchorWorkspaceState,
  CredentialStatus,
} from '@/types';
import { getChatModelDefinition, MAX_CHARACTER_ACTION_LENGTH } from '@/types';
import { useCharacterAnchorUpload } from './composables/useCharacterAnchorUpload';
import { useCharacterAnchorRename } from './composables/useCharacterAnchorRename';
import { useCharacterAnchorGenerator } from './composables/useCharacterAnchorGenerator';
import CharacterActionGeneratorPanel from './components/character-action-generator-panel.vue';
import CharacterAnchorGeneratorPanel from './components/character-anchor-generator-panel.vue';
import type { GeneratedAnchorRole } from './components/character-anchor-generator-panel.vue';
import AnchorGallery from './components/anchor-gallery.vue';
import AnchorPageHeader from './components/anchor-page-header.vue';
import AnchorAssetRenameDialog from './components/anchor-asset-rename-dialog.vue';
import AnchorUploadDialog from './components/anchor-upload-dialog.vue';

interface ActionReferenceOption extends ImageReferencePickerOption {
  selection: CharacterAnchorSelection;
}

const appStore = useAppStore();
const characterLibraryStore = useCharacterLibraryStore();
const route = useRoute();
const router = useRouter();
const actionPage = computed(() => route.name === 'character-action');
watch(actionPage, value => {
  if (value) {
    anchorGeneratorOpen.value = false;
  } else {
    closeGenerator();
  }
});

// 角色选择
const selectedCharacterId = ref('');
const characters = computed(() => characterLibraryStore.characters);

// 角色锚点工作区
const records = ref<CharacterAnchorRecord[]>([]);
const officialAssets = ref<CharacterAnchorSelection[]>([]);
const anchorBindings = ref<CharacterAnchorBinding[]>([]);
const errorMessage = ref('');
const isInitializing = ref(true);

const activeStatuses = ['submitted', 'pending', 'processing'];
const activeRecord = computed(() =>
  records.value.find(record => activeStatuses.includes(record.status)),
);
const displayedRecords = computed(() =>
  records.value.filter(record =>
    actionPage.value ? record.generationMode === 'action' : record.generationMode !== 'action',
  ),
);
const assetCount = computed(() =>
  displayedRecords.value.reduce((total, record) => total + record.images.length, 0),
);
const anchorRoleLabels = {
  standard: '标准参考图',
  turnaround: '角色转面图',
  face: '脸部与发型',
  'full-body': '全身与服装',
  'three-quarter': '四分之三视角',
  side: '侧面视角',
  back: '背面视角',
} as const;
const anchorCoverage = computed(() =>
  (Object.keys(anchorRoleLabels) as Array<keyof typeof anchorRoleLabels>).map(role => ({
    label: anchorRoleLabels[role],
    role,
    filled: anchorBindings.value.some(binding => binding.role === role),
  })),
);

// 参考资产
const selectedReferenceAsset = ref<CharacterAnchorSelection | null>(null);

function referenceAssetKey(selection: CharacterAnchorSelection): string {
  return `${selection.taskId}:${selection.fileName}`;
}

const referenceOptions = computed<ActionReferenceOption[]>(() =>
  [...officialAssets.value]
    .filter(selection => {
      const record = records.value.find(item => item.id === selection.taskId);
      return record?.generationMode !== 'action';
    })
    .sort((left, right) => {
      const priority = (selection: CharacterAnchorSelection): number => {
        const role = anchorBindings.value.find(
          binding => binding.taskId === selection.taskId && binding.fileName === selection.fileName,
        )?.role;
        return role === 'full-body' ? 0 : role === 'face' ? 1 : role === 'three-quarter' ? 2 : 3;
      };
      return priority(left) - priority(right);
    })
    .flatMap(selection => {
      const record = records.value.find(item => item.id === selection.taskId);
      const image = record?.images.find(item => item.fileName === selection.fileName);
      if (!record || !image) return [];
      return [
        {
          detail: `${record.source === 'uploaded' ? '已上传' : '已生成'} · ${
            anchorBindings.value.find(
              binding =>
                binding.taskId === selection.taskId && binding.fileName === selection.fileName,
            )?.role ?? '未指定职责'
          }`,
          image,
          key: referenceAssetKey(selection),
          label: image.name || record.name || '角色锚点',
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
const standardReference = computed(
  () =>
    referenceOptions.value.find(option =>
      anchorBindings.value.some(
        binding =>
          binding.role === 'standard' &&
          binding.taskId === option.selection.taskId &&
          binding.fileName === option.selection.fileName,
      ),
    ) ?? referenceOptions.value[0],
);

function syncSelectedReference(preferred?: CharacterAnchorSelection | null): void {
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
    void pollAnchorTask(taskId);
  }, 2500);
}

async function pollAnchorTask(taskId: string): Promise<void> {
  if (isDisposed) {
    return;
  }
  isPolling.value = true;
  pollingState.value = {
    phase: 'requesting',
    taskId,
  };
  try {
    const record = await characterAnchorApi.getTask(taskId);
    records.value = replaceRecord(records.value, record);
    errorMessage.value = '';
    if (activeStatuses.includes(record.status)) {
      schedulePoll(taskId);
      return;
    }
    if (record.status === 'completed') {
      toast.success(`“${record.name}”已生成并保存到角色锚点`);
      await refreshAnchorWorkspace();
    } else {
      errorMessage.value = record.errorMessage || '角色锚点生成任务未完成';
    }
    const nextRecord = records.value.find(
      item => item.id !== taskId && activeStatuses.includes(item.status),
    );
    if (nextRecord) {
      schedulePoll(nextRecord.id);
    } else {
      resetPollingState();
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
  void pollAnchorTask(activeRecord.value.id);
}

// 生成器
const action = ref('自然站立，抬起右手挥手，左手自然垂下。');
const imageName = ref('挥手');
const size = ref<CharacterVisualSize>('2:3');
const resolution = ref<CharacterVisualResolution>('1k');
const count = ref(2);
const anchorGeneratorOpen = ref(false);
const anchorResolution = ref<CharacterVisualResolution>('1k');
const selectedAnchorRoles = ref<GeneratedAnchorRole[]>([]);
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
    const record = await characterAnchorApi.generateAction({
      action: action.value.trim(),
      count: count.value,
      name: imageName.value.trim(),
      referenceAsset: {
        fileName: referenceAsset.fileName,
        taskId: referenceAsset.taskId,
      },
      resolution: resolution.value,
      size: size.value,
    });
    records.value = replaceRecord(records.value, record);
    await pollAnchorTask(record.id);
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
    action.value = await characterAnchorApi.generateActionPrompt({
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
  record: CharacterAnchorRecord;
} | null>(null);
const referenceDialogOpen = ref(false);
const { openUploadDialog, uploadDialogOpen } = useCharacterAnchorUpload();
const { renameAsset, renameDialogOpen, renamingFileName, renameTarget, requestRename } =
  useCharacterAnchorRename({
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
const isAnchorGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    isBusy.value ||
    !selectedCharacterId.value ||
    !keyConfigured.value ||
    !standardReference.value ||
    selectedAnchorRoles.value.length === 0,
);

const generatedAnchorPresets: Record<
  GeneratedAnchorRole,
  { name: string; prompt: string; size: CharacterVisualSize }
> = {
  turnaround: {
    name: '角色转面图',
    prompt:
      '基于标准参考图生成一张角色标准转面参考板：同一角色的正面全身、左侧三分之四视角、背面全身、右侧面部特写，四个视图整齐并列。严格保持脸部结构、五官、年龄感、发型、身体比例、服装、鞋子、配饰、线条和配色一致。白色纯净背景，无文字、无水印、无 Logo。',
    size: '16:9',
  },
  face: {
    name: '脸部与发型',
    prompt:
      '复制标准参考图中的角色身份，生成正面头肩特写。严格锁定脸型、五官比例、年龄感、肤色、发型轮廓、发色、耳部与头部配饰、服装领口、画风、线条和配色；使用中性表情和平视镜头，只展示头部与肩部。不得改变身份特征。白色纯净背景，无文字、无水印、无 Logo。',
    size: '1:1',
  },
  'full-body': {
    name: '全身与服装',
    prompt:
      '复制标准参考图中的角色身份，生成正面自然站立的完整全身设定图，从头顶到鞋底全部入镜。严格锁定脸部、年龄感、发型、身体比例、服装结构、鞋子、配饰、画风、线条和配色；双臂自然放松，不持有物品。白色纯净背景，无文字、无水印、无 Logo。',
    size: '2:3',
  },
  'three-quarter': {
    name: '四分之三视角',
    prompt:
      '复制标准参考图中的角色身份，生成左侧四分之三视角的完整全身设定图。严格锁定脸型、五官、年龄感、发型、身体比例、服装、鞋子、配饰、画风、线条和配色；只改变镜头视角，保持自然站立和中性表情。白色纯净背景，无文字、无水印、无 Logo。',
    size: '2:3',
  },
  side: {
    name: '侧面视角',
    prompt:
      '复制标准参考图中的角色身份，生成严格左侧面的完整全身设定图。锁定鼻梁、嘴唇、下颌、头骨、发型几何、年龄感、身体比例、服装、鞋子、配饰、画风、线条和配色；只改变视角，保持自然站立。白色纯净背景，无文字、无水印、无 Logo。',
    size: '2:3',
  },
  back: {
    name: '背面视角',
    prompt:
      '复制标准参考图中的角色身份，生成严格背面的完整全身设定图。准确延续后脑发型几何、发色、身体比例、服装背面结构、鞋子、配饰、画风、线条和配色；不出现正脸，不增加新设计。白色纯净背景，无文字、无水印、无 Logo。',
    size: '2:3',
  },
};

function getMissingAnchorRoles(): GeneratedAnchorRole[] {
  return (Object.keys(generatedAnchorPresets) as GeneratedAnchorRole[]).filter(
    role => !anchorBindings.value.some(binding => binding.role === role),
  );
}

const { closeGenerator, generatorOpen, openGenerator } = useCharacterAnchorGenerator({
  disabled: operationDisabled,
  onOpen: refreshAnchorWorkspace,
});

function openAnchorGenerator(): void {
  if (operationDisabled.value || actionPage.value) return;
  closeGenerator();
  selectedAnchorRoles.value = getMissingAnchorRoles();
  anchorGeneratorOpen.value = true;
}

function closeAnchorGenerator(): void {
  anchorGeneratorOpen.value = false;
}

async function generateAnchorBoard(): Promise<void> {
  const reference = standardReference.value;
  if (isAnchorGenerateDisabled.value || !reference) return;
  const generatedRecords: CharacterAnchorRecord[] = [];
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const referenceAsset = {
      fileName: reference.selection.fileName,
      taskId: reference.selection.taskId,
    };
    for (const role of selectedAnchorRoles.value) {
      const preset = generatedAnchorPresets[role];
      const record = await characterAnchorApi.generateReferenceBoard({
        anchorRole: role,
        name: preset.name,
        prompt: preset.prompt,
        referenceAssets: [referenceAsset],
        resolution: anchorResolution.value,
        size: preset.size,
      });
      generatedRecords.push(record);
      records.value = replaceRecord(records.value, record);
    }
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    isSubmitting.value = false;
  }
  const firstRecord = generatedRecords[0];
  if (!firstRecord) return;
  closeAnchorGenerator();
  toast.success(`已提交 ${generatedRecords.length} 个角色锚点任务`);
  await pollAnchorTask(firstRecord.id);
}

// 工作区加载
function replaceRecord<TRecord extends CharacterAnchorRecord>(
  recordList: TRecord[],
  updatedRecord: TRecord,
): TRecord[] {
  return [updatedRecord, ...recordList.filter(record => record.id !== updatedRecord.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function applyWorkspace(
  workspace: CharacterAnchorWorkspaceState,
  preferredReference?: CharacterAnchorSelection | null,
): void {
  officialAssets.value = workspace.officialAssets;
  anchorBindings.value = workspace.anchorBindings;
  records.value = workspace.records;
  syncSelectedReference(preferredReference);
}

function applyCharacterAnchorWorkspace(anchorWorkspace: CharacterAnchorWorkspaceState): void {
  const latestGeneratedRecord = anchorWorkspace.records.find(
    record => record.generationMode === 'action',
  );
  applyWorkspace(anchorWorkspace, latestGeneratedRecord?.referenceAssets[0]);
  action.value = latestGeneratedRecord?.prompt || '自然站立，抬起右手挥手，左手自然垂下。';
  imageName.value = latestGeneratedRecord?.name || '挥手';
  size.value = latestGeneratedRecord?.size ?? '2:3';
  resolution.value = latestGeneratedRecord?.resolution ?? '1k';
  count.value = latestGeneratedRecord?.count ?? 2;

  const unfinishedRecord = anchorWorkspace.records.find(record =>
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
  anchorBindings.value = [];
  selectedReferenceAsset.value = null;
  try {
    const anchorWorkspace = await characterAnchorApi.getWorkspace({
      characterId,
    });
    if (requestId !== loadRequestId || selectedCharacterId.value !== characterId) {
      return;
    }
    applyCharacterAnchorWorkspace(anchorWorkspace);
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

async function refreshAnchorWorkspace(): Promise<void> {
  try {
    applyWorkspace(
      await characterAnchorApi.getWorkspace({
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
  record: CharacterAnchorRecord,
  image: CharacterVisualImage,
  official: boolean,
): Promise<void> {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  selectingFileName.value = image.fileName;
  try {
    const workspace = await characterAnchorApi.setOfficial({
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

async function setAnchorRole(
  record: CharacterAnchorRecord,
  image: CharacterVisualImage,
  role: CharacterAnchorBinding['role'],
): Promise<void> {
  if (selectingFileName.value || deletingFileName.value) return;
  selectingFileName.value = image.fileName;
  try {
    const workspace = await characterAnchorApi.setOfficial({
      fileName: image.fileName,
      official: true,
      role,
      taskId: record.id,
    });
    applyWorkspace(workspace);
    toast.success('身份锚点职责已更新');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    selectingFileName.value = '';
  }
}

function requestDelete(record: CharacterAnchorRecord, image: CharacterVisualImage): void {
  if (selectingFileName.value || deletingFileName.value) {
    return;
  }
  deleteTarget.value = { image, record };
  deleteDialogOpen.value = true;
}

function editImage(record: CharacterAnchorRecord, image: CharacterVisualImage): void {
  void router.push({
    name: 'image-editor',
    query: {
      fileName: image.name || record.name || image.fileName,
      mimeType: image.mimeType,
      returnTo: 'character-anchor',
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
    const workspace = await characterAnchorApi.deleteAnchor({
      fileName: image.fileName,
      taskId: record.id,
    });
    applyWorkspace(workspace);
    deleteDialogOpen.value = false;
    deleteTarget.value = null;
    toast.success('角色锚点图片已删除');
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
      await characterAnchorApi.getWorkspace({
        characterId: selectedCharacterId.value,
      }),
    );
    toast.success('角色锚点图片已上传');
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
  <SagPage
    :title="actionPage ? '角色动作' : '角色锚点'"
    :description="
      actionPage ? '基于正式角色锚点生成和管理动作资产' : '从标准参考图生成可复用的角色身份锚点'
    "
    :icon="actionPage ? Camera : PanelsTopLeft"
  >
    <template #header-leading>
      <Badge variant="secondary" class="shrink-0 tabular-nums">{{ assetCount }}</Badge>
    </template>

    <template #header-actions>
      <AnchorPageHeader
        :characters="characters"
        :action-page="actionPage"
        :character-selection-disabled="characterSelectionDisabled"
        :generator-open="generatorOpen"
        :operation-disabled="operationDisabled"
        :selected-character-id="selectedCharacterId"
        @ai-create="openGenerator"
        @anchor-create="openAnchorGenerator"
        @upload="openUpload"
        @update:selected-character-id="selectCharacter"
      />
    </template>

    <section
      v-if="!actionPage"
      class="mx-4 mt-3 shrink-0 rounded-md border bg-background px-4 py-3 sm:mx-5"
      aria-label="核心锚点覆盖"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-sm font-medium">核心身份锚点</h2>
          <p class="mt-1 text-xs text-muted-foreground">
            正式图片可以指定唯一职责；动作和表情不会自动改写身份锚点。
          </p>
        </div>
        <span class="text-xs tabular-nums text-muted-foreground">
          {{ anchorCoverage.filter(item => item.filled).length }} /
          {{ anchorCoverage.length }} 已覆盖
        </span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 md:grid-cols-7">
        <div
          v-for="item in anchorCoverage"
          :key="item.role"
          class="flex items-center gap-2 rounded-sm border px-2.5 py-2 text-xs"
          :class="
            item.filled ? 'border-primary/30 bg-primary/5' : 'border-dashed text-muted-foreground'
          "
        >
          <span
            class="size-1.5 rounded-full"
            :class="item.filled ? 'bg-primary' : 'bg-muted-foreground/40'"
          />
          {{ item.label }}
        </div>
      </div>
    </section>

    <Alert
      v-if="actionPage && !isInitializing && !hasOfficialReference"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
    >
      <AlertCircle class="size-4" />
      <AlertTitle>生成动作需要正式角色锚点</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>请先在角色锚点中上传标准参考图，或将锚点参考板设为正式资产。</span>
        <Button size="sm" variant="outline" @click="openUpload">上传角色锚点</Button>
      </AlertDescription>
    </Alert>

    <SagMissingPrerequisiteAlert
      v-if="!isInitializing && !keyConfigured"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
      title="生成图片需要 APIMart API Key"
      description="上传已有角色锚点图片不受影响。"
      action-label="前往设置"
      to="/settings"
    />

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 w-auto shrink-0 sm:mx-5">
      <AlertCircle class="size-4" />
      <AlertTitle>{{ actionPage ? '角色动作' : '角色锚点' }}生成暂时中断</AlertTitle>
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
        (generatorOpen || anchorGeneratorOpen) && 'lg:grid-cols-[minmax(0,5fr)_minmax(340px,2fr)]',
      ]"
    >
      <div class="flex min-h-0 min-w-0 lg:flex">
        <AnchorGallery
          :deleting-file-name="deletingFileName"
          :anchor-bindings="anchorBindings"
          :official-assets="officialAssets"
          :polling-state="pollingState"
          :records="displayedRecords"
          :renaming-file-name="renamingFileName"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
          @edit="editImage"
          @official="selectAsset"
          @role="setAnchorRole"
          @rename="requestRename"
        />
      </div>
      <div v-if="anchorGeneratorOpen" class="flex min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5">
        <CharacterAnchorGeneratorPanel
          :busy="isSubmitting"
          :disabled="isAnchorGenerateDisabled"
          :filled-roles="anchorBindings.map(binding => binding.role)"
          :reference="standardReference"
          :resolution="anchorResolution"
          :selected-roles="selectedAnchorRoles"
          class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border bg-background shadow-sm"
          @close="closeAnchorGenerator"
          @generate="generateAnchorBoard"
          @update:resolution="anchorResolution = $event"
          @update:selected-roles="selectedAnchorRoles = $event"
        />
      </div>
      <div
        v-else-if="actionPage && generatorOpen"
        class="flex min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5"
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

    <AnchorUploadDialog
      v-model:open="uploadDialogOpen"
      :character-id="selectedCharacterId"
      @uploaded="handleUploaded"
    />

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="isSubmitting"
      description="只能选择当前角色的正式锚点。生成时将锁定角色外观，只改变姿势。"
      :filters="[]"
      :max-selection="1"
      :options="referenceOptions"
      :selected-keys="selectedReferenceKeys"
      title="选择正式角色锚点"
      @confirm="selectReferenceAsset"
    />

    <AnchorAssetRenameDialog
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
