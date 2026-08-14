import { computed, onBeforeUnmount, ref, type ComputedRef, type Ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { characterAnchorApi } from '@/lib/character-anchor-api';
import { useCharacterLibraryStore } from '@/stores/character-library';
import type {
  CharacterAnchorBinding,
  CharacterAnchorRecord,
  CharacterAnchorSelection,
  CharacterAnchorWorkspaceState,
  CharacterLibraryCharacter,
  CharacterVisualImage,
  CredentialStatus,
} from '@/types';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import { useCharacterAnchorRename } from './useCharacterAnchorRename';
import { useCharacterAnchorUpload } from './useCharacterAnchorUpload';

export interface CharacterWorkspaceReferenceOption {
  image: CharacterVisualImage;
  key: string;
  label: string;
  record: CharacterAnchorRecord;
  selection: CharacterAnchorSelection;
}

export interface UseCharacterWorkspaceOptions {
  busy: ComputedRef<boolean>;
  onWorkspaceApplied?: (
    workspace: CharacterAnchorWorkspaceState,
    syncSelectedReference: (preferred?: CharacterAnchorSelection | null) => void,
  ) => void;
  returnTo?: string;
}

export interface UseCharacterWorkspace {
  records: Ref<CharacterAnchorRecord[]>;
  officialAssets: Ref<CharacterAnchorSelection[]>;
  anchorBindings: Ref<CharacterAnchorBinding[]>;
  errorMessage: Ref<string>;
  isInitializing: Ref<boolean>;
  activeRecord: ComputedRef<CharacterAnchorRecord | undefined>;
  selectedCharacterId: Ref<string>;
  characters: ComputedRef<CharacterLibraryCharacter[]>;
  pollingState: Ref<GenerationTaskPollingState>;
  isPolling: Ref<boolean>;
  credentialStatus: Ref<CredentialStatus | null>;
  keyConfigured: ComputedRef<boolean>;
  deepseekStatus: Ref<CredentialStatus | null>;
  minimaxStatus: Ref<CredentialStatus | null>;
  selectedReferenceAsset: Ref<CharacterAnchorSelection | null>;
  referenceOptions: ComputedRef<CharacterWorkspaceReferenceOption[]>;
  selectedReferenceKeys: ComputedRef<string[]>;
  selectedReferenceOptions: ComputedRef<CharacterWorkspaceReferenceOption[]>;
  hasOfficialReference: ComputedRef<boolean>;
  selectingFileName: Ref<string>;
  deletingFileName: Ref<string>;
  renameDialogOpen: Ref<boolean>;
  renamingFileName: Ref<string>;
  renameTarget: Ref<{ image: CharacterVisualImage; record: CharacterAnchorRecord } | null>;
  deleteDialogOpen: Ref<boolean>;
  deleteTarget: Ref<{ image: CharacterVisualImage; record: CharacterAnchorRecord } | null>;
  referenceDialogOpen: Ref<boolean>;
  uploadDialogOpen: Ref<boolean>;
  isBusy: ComputedRef<boolean>;
  characterSelectionDisabled: ComputedRef<boolean>;
  operationDisabled: ComputedRef<boolean>;
  initialize: () => Promise<void>;
  selectCharacter: (characterId: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
  loadCharacterWorkspace: (characterId: string) => Promise<void>;
  applyWorkspace: (
    workspace: CharacterAnchorWorkspaceState,
    preferredReference?: CharacterAnchorSelection | null,
  ) => void;
  syncSelectedReference: (preferred?: CharacterAnchorSelection | null) => void;
  selectReferenceAsset: (keys: string[]) => void;
  pollAnchorTask: (taskId: string) => Promise<void>;
  retryPolling: () => void;
  resumeActivePolling: () => void;
  startPolling: (taskId: string) => void;
  selectAsset: (
    record: CharacterAnchorRecord,
    image: CharacterVisualImage,
    official: boolean,
  ) => Promise<void>;
  setAnchorRole: (
    record: CharacterAnchorRecord,
    image: CharacterVisualImage,
    role: CharacterAnchorBinding['role'],
  ) => Promise<void>;
  requestDelete: (record: CharacterAnchorRecord, image: CharacterVisualImage) => void;
  deleteAsset: () => Promise<void>;
  editImage: (record: CharacterAnchorRecord, image: CharacterVisualImage) => void;
  requestRename: (record: CharacterAnchorRecord, image: CharacterVisualImage) => void;
  renameAsset: (nextName: string) => Promise<void>;
  openUpload: () => void;
  handleUploaded: () => Promise<void>;
}

export function useCharacterWorkspace(
  options: UseCharacterWorkspaceOptions,
): UseCharacterWorkspace {
  const characterLibraryStore = useCharacterLibraryStore();
  const route = useRoute();
  const router = useRouter();

  const records = ref<CharacterAnchorRecord[]>([]);
  const officialAssets = ref<CharacterAnchorSelection[]>([]);
  const anchorBindings = ref<CharacterAnchorBinding[]>([]);
  const errorMessage = ref('');
  const isInitializing = ref(true);

  const selectedCharacterId = ref('');
  const characters = computed(() => characterLibraryStore.characters);

  const activeStatuses = ['submitted', 'pending', 'processing'];
  const activeRecord = computed(() =>
    records.value.find(record => activeStatuses.includes(record.status)),
  );

  const isPolling = ref(false);
  const pollingState = ref<GenerationTaskPollingState>({ phase: 'idle', taskId: '' });
  let pollTimer: ReturnType<typeof setTimeout> | null = null;
  let isDisposed = false;
  let loadRequestId = 0;

  const credentialStatus = ref<CredentialStatus | null>(null);
  const deepseekStatus = ref<CredentialStatus | null>(null);
  const minimaxStatus = ref<CredentialStatus | null>(null);
  const keyConfigured = computed(() => Boolean(credentialStatus.value?.configured));

  const selectedReferenceAsset = ref<CharacterAnchorSelection | null>(null);

  function referenceAssetKey(selection: CharacterAnchorSelection): string {
    return `${selection.taskId}:${selection.fileName}`;
  }

  const referenceOptions = computed<CharacterWorkspaceReferenceOption[]>(() =>
    [...officialAssets.value]
      .filter(selection => {
        const record = records.value.find(item => item.id === selection.taskId);
        return record?.generationMode !== 'action';
      })
      .flatMap(selection => {
        const record = records.value.find(item => item.id === selection.taskId);
        const image = record?.images.find(item => item.fileName === selection.fileName);
        if (!record || !image) return [];
        return [
          {
            image,
            key: referenceAssetKey(selection),
            label: image.name || record.name || '角色锚点',
            record,
            selection,
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
      resetPollingState();
      if (record.status === 'completed') {
        toast.success(`"${record.name}" 已生成并保存`);
      } else {
        errorMessage.value = record.errorMessage || '角色锚点生成任务未完成';
      }
      const nextRecord = records.value.find(
        item => item.id !== taskId && activeStatuses.includes(item.status),
      );
      if (nextRecord) {
        schedulePoll(nextRecord.id);
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

  function resumeActivePolling(): void {
    const unfinished = records.value.find(record => activeStatuses.includes(record.status));
    if (unfinished) {
      schedulePoll(unfinished.id);
    } else {
      resetPollingState();
    }
  }

  function startPolling(taskId: string): void {
    schedulePoll(taskId);
  }

  const selectingFileName = ref('');
  const deletingFileName = ref('');
  const deleteDialogOpen = ref(false);
  const deleteTarget = ref<{ image: CharacterVisualImage; record: CharacterAnchorRecord } | null>(
    null,
  );
  const referenceDialogOpen = ref(false);
  const { openUploadDialog, uploadDialogOpen } = useCharacterAnchorUpload();
  const { renameAsset, renameDialogOpen, renamingFileName, renameTarget, requestRename } =
    useCharacterAnchorRename({
      onRenamed(nextRecords) {
        records.value = nextRecords;
      },
    });

  const isBusy = computed(() => options.busy.value || Boolean(activeRecord.value));
  const characterSelectionDisabled = computed(
    () =>
      isInitializing.value ||
      isBusy.value ||
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
    options.onWorkspaceApplied?.(workspace, syncSelectedReference);
    syncSelectedReference(preferredReference);
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
      const workspace = await characterAnchorApi.getWorkspace({
        characterId,
      });
      if (requestId !== loadRequestId || selectedCharacterId.value !== characterId) {
        return;
      }
      applyWorkspace(workspace);
    } catch (loadError: unknown) {
      if (requestId !== loadRequestId) {
        return;
      }
      errorMessage.value = loadError instanceof Error ? loadError.message : String(loadError);
    } finally {
      if (requestId === loadRequestId) {
        isInitializing.value = false;
      }
    }
  }

  async function refreshWorkspace(): Promise<void> {
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
      toast.error(
        selectionError instanceof Error ? selectionError.message : String(selectionError),
      );
    } finally {
      selectingFileName.value = '';
    }
  }

  async function setAnchorRole(
    record: CharacterAnchorRecord,
    image: CharacterVisualImage,
    role: CharacterAnchorBinding['role'],
  ): Promise<void> {
    if (selectingFileName.value || deletingFileName.value) {
      return;
    }
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
        returnTo: options.returnTo ?? 'character-anchor',
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

  onBeforeUnmount(() => {
    isDisposed = true;
    clearPollTimer();
  });

  return {
    records,
    officialAssets,
    anchorBindings,
    errorMessage,
    isInitializing,
    activeRecord,
    selectedCharacterId,
    characters,
    pollingState,
    isPolling,
    credentialStatus,
    keyConfigured,
    deepseekStatus,
    minimaxStatus,
    selectedReferenceAsset,
    referenceOptions,
    selectedReferenceKeys,
    selectedReferenceOptions,
    hasOfficialReference,
    selectingFileName,
    deletingFileName,
    renameDialogOpen,
    renamingFileName,
    renameTarget,
    deleteDialogOpen,
    deleteTarget,
    referenceDialogOpen,
    uploadDialogOpen,
    isBusy,
    characterSelectionDisabled,
    operationDisabled,
    initialize,
    selectCharacter,
    refreshWorkspace,
    loadCharacterWorkspace,
    applyWorkspace,
    syncSelectedReference,
    selectReferenceAsset,
    pollAnchorTask,
    retryPolling,
    resumeActivePolling,
    startPolling,
    selectAsset,
    setAnchorRole,
    requestDelete,
    deleteAsset,
    editImage,
    requestRename,
    renameAsset,
    openUpload,
    handleUploaded,
  };
}
