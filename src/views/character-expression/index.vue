<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Laugh } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { useCredentialStatus } from '@/composables/use-credential-status';
import { useGenerationPolling } from '@/composables/use-generation-polling';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import { ImageReferencePickerDialog } from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagMissingPrerequisiteAlert } from '@/components/sag/missing-prerequisite-alert';
import { SagPage } from '@/components/sag/sag-page';
import { useAppStore } from '@/stores/app';
import type {
  CharacterExpressionRecord,
  CharacterExpressionSize,
  CharacterExpressionTask,
  CharacterExpressionTaskResult,
  CharacterExpressionWorkspaceState,
  CharacterLibraryState,
  CharacterVisualImage,
  CharacterVisualResolution,
  CharacterVisualWorkspaceState,
} from '@/types';
import { getChatModelDefinition, MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES } from '@/types';
import ExpressionEmptyState from './components/expression-empty-state.vue';
import ExpressionGeneratorPanel from './components/expression-generator-panel.vue';
import ExpressionPageHeader from './components/expression-page-header.vue';
import ExpressionRenameDialog from './components/expression-rename-dialog.vue';
import ExpressionUploadDialog from './components/expression-upload-dialog.vue';
import ExpressionRecords from './components/expression-records.vue';
import { useExpressionDelete } from './composables/use-expression-delete';
import { useExpressionReferences } from './composables/use-expression-references';
import { useExpressionRename } from './composables/use-expression-rename';
import { useExpressionSearch } from './composables/use-expression-search';
import { useGeneratorOpen } from './composables/use-generator-open';
import { useReferenceDialog } from './composables/use-reference-dialog';
import { useUpload } from './composables/use-upload';
import { provideExpressionRecords } from './contexts/expression-records-context';
import { toErrorMessage } from '@/utils/helpers';
import { ACTIVE_STATUSES, REFERENCE_FILTERS } from './constants/index';

const appStore = useAppStore();
const router = useRouter();

const { uploadDialogOpen, openUploadDialog } = useUpload();
const { generatorOpen, openGenerator, closeGenerator } = useGeneratorOpen();
const { referenceDialogOpen, openReferenceDialog } = useReferenceDialog();
const {
  apimartConfigured,
  deepseekConfigured,
  minimaxConfigured,
  refresh: refreshCredentialStatus,
} = useCredentialStatus();

const library = ref<CharacterLibraryState | null>(null);
const selectedCharacterId = ref('');
const records = ref<CharacterExpressionRecord[]>([]);
const tasks = ref<CharacterExpressionTask[]>([]);

const visualWorkspace = ref<CharacterVisualWorkspaceState | null>(null);

const {
  hasReferences,
  referenceOptions,
  resetReferences,
  selectedReferenceAssets,
  selectedReferenceKeys,
  selectedReferenceOptions,
  selectReferenceAssets,
} = useExpressionReferences({ records, visualWorkspace });

const { deleteDialogOpen, deleteExpression, deletingFileName, requestDelete } = useExpressionDelete(
  {
    characterId: selectedCharacterId,
    onDeleted(nextRecords) {
      records.value = nextRecords;
    },
  },
);
const { searchQuery, filteredRecords, filteredTasks, cleanQuery } = useExpressionSearch({
  records,
  tasks,
});
const { renameDialogOpen, renameExpression, renameTarget, renamingTaskId, requestRename } =
  useExpressionRename({
    characterId: selectedCharacterId,
    onRenamed(nextRecords) {
      records.value = nextRecords;
    },
  });

const name = ref('');
const description = ref('');
const size = ref<CharacterExpressionSize>('1:1');
const resolution = ref<CharacterVisualResolution>('1k');
const count = ref(2);
const errorMessage = ref('');
const isInitializing = ref(true);
const isSubmitting = ref(false);
const isGeneratingPrompt = ref(false);

interface ExpressionPollingTarget {
  characterId: string;
  taskId: string;
}

const {
  cancelAll: resetPolling,
  pollingStates,
  pollNow: pollExpressionTask,
  schedulePoll,
} = useGenerationPolling<CharacterExpressionTaskResult, ExpressionPollingTarget>({
  async fetchTask(target) {
    const result = await window.desktop.character.expression.getCharacterExpressionTask(target);
    if (!result.record && !result.task) {
      throw new Error('表情任务返回结果无效');
    }
    return result;
  },
  isStillRunning: result => Boolean(result.task && ACTIVE_STATUSES.includes(result.task.status)),
  isTerminalSuccess: result => Boolean(result.record),
  onPollSuccess(taskId, result) {
    errorMessage.value = '';
    if (result.record) {
      removeTask(taskId);
      replaceRecord(result.record);
    } else if (result.task) {
      replaceTask(result.task);
    }
  },
  onCompleted(_taskId, result) {
    if (result.record) {
      toast.success(`“${result.record.name}”表情已生成并保存到工作区`);
    }
  },
  onFailed(_taskId, result) {
    errorMessage.value = result.task?.errorMessage || '表情生成任务未完成';
  },
  onError(_taskId, error) {
    errorMessage.value = toErrorMessage(error);
  },
});
const pollingState = computed<GenerationTaskPollingState>(() => {
  const entry = Object.entries(pollingStates.value)[0];
  return entry ? { phase: entry[1].phase, taskId: entry[0] } : { phase: 'idle', taskId: '' };
});
const isPolling = computed(() => pollingState.value.phase === 'requesting');

provideExpressionRecords({
  deletingFileName,
  editExpression,
  pollingState,
  renamingTaskId,
  requestDelete,
  requestRename,
});

let loadRequestId = 0;

const characters = computed(() => library.value?.characters ?? []);
const activeTask = computed(() => tasks.value.find(task => ACTIVE_STATUSES.includes(task.status)));
const keyConfigured = apimartConfigured;
const fastModelProvider = computed(
  () => getChatModelDefinition(appStore.settings.fastModel).provider,
);
const promptGenerationAvailable = computed(() =>
  fastModelProvider.value === 'minimax' ? minimaxConfigured.value : deepseekConfigured.value,
);
const isBusy = computed(() => isSubmitting.value || Boolean(activeTask.value));
const characterSelectionDisabled = computed(
  () =>
    isInitializing.value ||
    isSubmitting.value ||
    isGeneratingPrompt.value ||
    Boolean(deletingFileName.value) ||
    Boolean(renamingTaskId.value),
);
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

function replaceRecord(updatedRecord: CharacterExpressionRecord): void {
  records.value = [
    updatedRecord,
    ...records.value.filter(record => record.id !== updatedRecord.id),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function replaceTask(updatedTask: CharacterExpressionTask): void {
  tasks.value = [updatedTask, ...tasks.value.filter(task => task.id !== updatedTask.id)].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt),
  );
}

function removeTask(taskId: string): void {
  tasks.value = tasks.value.filter(task => task.id !== taskId);
}

function applyExpressionPageData(
  expressionWorkspace: CharacterExpressionWorkspaceState,
  currentVisualWorkspace: CharacterVisualWorkspaceState,
): void {
  records.value = expressionWorkspace.records;
  tasks.value = expressionWorkspace.tasks;
  visualWorkspace.value = currentVisualWorkspace;
  resetReferences();

  const latestGeneratedRecord = expressionWorkspace.records.find(
    record => record.source === 'generated',
  );
  name.value = '';
  description.value = '';
  size.value = latestGeneratedRecord?.size ?? '1:1';
  resolution.value = latestGeneratedRecord?.resolution ?? '1k';
  count.value = latestGeneratedRecord?.count ?? 2;

  if (activeTask.value) {
    openGenerator();
    schedulePoll({
      characterId: selectedCharacterId.value,
      taskId: activeTask.value.id,
    });
  }
}

// 加载表情数据
async function loadExpressionPageData(characterId: string): Promise<void> {
  const requestId = ++loadRequestId;
  resetPolling();
  isInitializing.value = true;
  errorMessage.value = '';
  records.value = [];
  tasks.value = [];
  visualWorkspace.value = null;
  resetReferences();

  try {
    const [expressionWorkspace, currentVisualWorkspace] = await Promise.all([
      window.desktop.character.expression.getCharacterExpressionWorkspace({ characterId }),
      window.desktop.character.assets.getCharacterVisualWorkspace({ characterId }),
    ]);
    if (requestId !== loadRequestId || selectedCharacterId.value !== characterId) {
      return;
    }
    applyExpressionPageData(expressionWorkspace, currentVisualWorkspace);
  } catch (initializationError: unknown) {
    if (requestId !== loadRequestId) {
      return;
    }
    errorMessage.value = toErrorMessage(initializationError);
  } finally {
    if (requestId === loadRequestId) {
      isInitializing.value = false;
    }
  }
}

// 初始化
async function initialize(): Promise<void> {
  isInitializing.value = true;
  errorMessage.value = '';
  try {
    const [characterLibrary] = await Promise.all([
      window.desktop.character.library.getCharacterLibrary(),
      refreshCredentialStatus(),
    ]);
    library.value = characterLibrary;
    selectedCharacterId.value = characterLibrary.activeCharacterId;
    await loadExpressionPageData(characterLibrary.activeCharacterId);
  } catch (initializationError: unknown) {
    errorMessage.value = toErrorMessage(initializationError);
    isInitializing.value = false;
  }
}

// 选择角色
function selectCharacter(characterId: string): void {
  if (
    characterSelectionDisabled.value ||
    characterId === selectedCharacterId.value ||
    !characters.value.some(character => character.id === characterId)
  ) {
    return;
  }
  selectedCharacterId.value = characterId;
  resetReferences();
  void loadExpressionPageData(characterId);
}

// 生成表情
async function generateExpression(): Promise<void> {
  const characterId = selectedCharacterId.value;
  if (isGenerateDisabled.value || !characterId) {
    return;
  }
  isSubmitting.value = true;
  errorMessage.value = '';
  try {
    const task = await window.desktop.character.expression.generateCharacterExpression({
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
    replaceTask(task);
    await pollExpressionTask({ characterId, taskId: task.id });
  } catch (generationError: unknown) {
    errorMessage.value = toErrorMessage(generationError);
  } finally {
    isSubmitting.value = false;
  }
}

// 重试
function retryPolling(): void {
  if (!activeTask.value || isPolling.value) {
    return;
  }
  errorMessage.value = '';
  void pollExpressionTask({
    characterId: selectedCharacterId.value,
    taskId: activeTask.value.id,
  });
}

// 生成表情提示词
async function generateExpressionPrompt(): Promise<void> {
  if (isGeneratingPrompt.value || !promptGenerationAvailable.value || !name.value.trim()) {
    return;
  }
  isGeneratingPrompt.value = true;
  try {
    description.value = await window.desktop.character.expression.generateCharacterExpressionPrompt(
      {
        model: appStore.settings.fastModel,
        name: name.value.trim(),
      },
    );
    toast.success('表情提示词已生成');
  } catch (promptError: unknown) {
    toast.error(toErrorMessage(promptError));
  } finally {
    isGeneratingPrompt.value = false;
  }
}

// 编辑表情
function editExpression(record: CharacterExpressionRecord, image: CharacterVisualImage): void {
  void router.push({
    name: 'image-editor',
    query: {
      fileName: record.name || image.fileName,
      mimeType: image.mimeType,
      returnTo: 'character-expression',
      sourceUrl: image.url,
    },
  });
}

// 上传后刷新
async function refreshExpressionsAfterUpload(): Promise<void> {
  try {
    const workspace = await window.desktop.character.expression.getCharacterExpressionWorkspace({
      characterId: selectedCharacterId.value,
    });
    records.value = workspace.records;
    tasks.value = workspace.tasks;
    toast.success('表情已上传并保存到工作区');
  } catch (uploadError: unknown) {
    toast.error(toErrorMessage(uploadError));
  }
}

onMounted(() => {
  void initialize();
});
</script>

<template>
  <SagPage title="表情管理" description="基于正式角色资产生成与管理表情" :icon="Laugh">
    <template #header-actions>
      <ExpressionPageHeader
        v-model:search-query="searchQuery"
        :characters="characters"
        :character-selection-disabled="characterSelectionDisabled"
        :generator-open="generatorOpen"
        :selected-character-id="selectedCharacterId"
        @ai-create="openGenerator"
        @upload="openUploadDialog"
        @update:selected-character-id="selectCharacter"
      />
    </template>

    <SagMissingPrerequisiteAlert
      v-if="!isInitializing && !hasReferences"
      class="mx-4 mt-3 shrink-0 sm:mx-5"
      title="生成表情需要角色参考"
      description="可以先准备角色视觉，或上传一张已有表情。"
      action-label="前往角色视觉"
      to="/character-visual"
    />

    <SagMissingPrerequisiteAlert
      v-if="!isInitializing && !keyConfigured"
      class="mx-4 mt-3 shrink-0 sm:mx-5"
      title="生成图片需要 APIMart API Key"
      description="上传已有表情不受影响。"
      action-label="前往设置"
      to="/settings"
    />

    <SagErrorRetryAlert
      v-if="errorMessage"
      class="mx-4 mt-3 shrink-0 sm:mx-5"
      title="表情流程暂时中断"
      :error-message="errorMessage"
      retry-label="继续查询"
      :can-retry="activeTask && !isPolling"
      @retry="retryPolling"
    />

    <div
      :class="[
        'grid min-h-0 min-w-0 flex-1 grid-cols-1 overflow-hidden',
        generatorOpen && 'lg:grid-cols-[minmax(0,5fr)_minmax(340px,2fr)]',
      ]"
    >
      <section class="flex min-h-0 min-w-0 flex-1 flex-col bg-muted/15" aria-label="表情资产库">
        <ScrollArea class="min-h-0 flex-1">
          <ExpressionRecords
            v-if="filteredRecords.length || filteredTasks.length"
            :records="filteredRecords"
            :tasks="filteredTasks"
          />

          <ExpressionEmptyState
            v-else
            :search-query="searchQuery"
            @update:search-query="cleanQuery"
          />
        </ScrollArea>
      </section>

      <div v-if="generatorOpen" class="flex min-h-0 min-w-0 p-3 sm:p-4 lg:p-5">
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
          @open-reference-picker="openReferenceDialog"
        />
      </div>
    </div>

    <ExpressionUploadDialog
      v-model:open="uploadDialogOpen"
      :character-id="selectedCharacterId"
      @uploaded="refreshExpressionsAfterUpload"
    />

    <ImageReferencePickerDialog
      v-model:open="referenceDialogOpen"
      :busy="isSubmitting"
      description="可以混选当前角色的视觉资产和已有表情，生成时只使用这里确认的图片。"
      :filters="REFERENCE_FILTERS"
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
