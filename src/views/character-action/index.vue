<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { Camera } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ImageReferencePickerDialog,
  type ImageReferencePickerOption,
} from '@/components/sag/image-reference-picker-dialog';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagMissingPrerequisiteAlert } from '@/components/sag/missing-prerequisite-alert';
import { SagPage } from '@/components/sag/sag-page';
import { characterAnchorApi } from '@/lib/character-anchor-api';
import { useAppStore } from '@/stores/app';
import type {
  CharacterAnchorRecord,
  CharacterVisualResolution,
  CharacterVisualSize,
} from '@/types';
import { getChatModelDefinition, MAX_CHARACTER_ACTION_LENGTH } from '@/types';
import { useCharacterAnchorGenerator } from '../character-anchor/composables/useCharacterAnchorGenerator';
import { useCharacterWorkspace } from '../character-anchor/composables/useCharacterWorkspace';
import AnchorGallery from '../character-anchor/components/anchor-gallery.vue';
import ActionPageHeader from '../character-anchor/components/action-page-header.vue';
import CharacterActionGeneratorPanel from '../character-anchor/components/character-action-generator-panel.vue';
import AnchorAssetRenameDialog from '../character-anchor/components/anchor-asset-rename-dialog.vue';
import AnchorUploadDialog from '../character-anchor/components/anchor-upload-dialog.vue';

const appStore = useAppStore();

const action = ref('自然站立，抬起右手挥手，左手自然垂下。');
const imageName = ref('挥手');
const size = ref<CharacterVisualSize>('2:3');
const resolution = ref<CharacterVisualResolution>('1k');
const count = ref(2);
const isSubmitting = ref(false);
const isGeneratingPrompt = ref(false);

const busy = computed(() => isSubmitting.value || isGeneratingPrompt.value);

const {
  activeRecord,
  characters,
  characterSelectionDisabled,
  deepseekStatus,
  deleteAsset,
  deleteDialogOpen,
  deleteTarget,
  deletingFileName,
  editImage,
  errorMessage,
  hasOfficialReference,
  initialize,
  isInitializing,
  isPolling,
  keyConfigured,
  minimaxStatus,
  officialAssets,
  openUpload,
  operationDisabled,
  pollingState,
  records,
  referenceDialogOpen,
  refreshWorkspace,
  renameAsset,
  renameDialogOpen,
  renamingFileName,
  renameTarget,
  requestDelete,
  requestRename,
  resumeActivePolling,
  retryPolling,
  selectAsset,
  selectCharacter,
  selectedCharacterId,
  selectedReferenceAsset,
  selectedReferenceKeys,
  selectedReferenceOptions,
  selectingFileName,
  uploadDialogOpen,
  handleUploaded,
  pollAnchorTask,
  selectReferenceAsset,
} = useCharacterWorkspace({
  busy,
  onWorkspaceApplied: state => {
    const latestAction = state.records.find(record => record.generationMode === 'action');
    action.value = latestAction?.prompt || action.value;
    imageName.value = latestAction?.name || imageName.value;
    size.value = latestAction?.size ?? size.value;
    resolution.value = latestAction?.resolution ?? resolution.value;
    count.value = latestAction?.count ?? count.value;
    resumeActivePolling();
  },
  returnTo: 'character-action',
});

const { closeGenerator, generatorOpen, openGenerator } = useCharacterAnchorGenerator({
  disabled: operationDisabled,
  onOpen: () => {
    void refreshWorkspace();
  },
});

const fastModelProvider = computed(
  () => getChatModelDefinition(appStore.settings.fastModel).provider,
);
const promptGenerationAvailable = computed(() =>
  fastModelProvider.value === 'minimax'
    ? Boolean(minimaxStatus.value?.configured)
    : Boolean(deepseekStatus.value?.configured),
);

const actionRecords = computed<CharacterAnchorRecord[]>(() =>
  records.value.filter(record => record.generationMode === 'action'),
);
const actionAssetCount = computed(() =>
  actionRecords.value.reduce((total, record) => total + record.images.length, 0),
);
const pickerOptions = computed<ImageReferencePickerOption[]>(() =>
  selectedReferenceOptions.value.map(option => ({
    detail: `${option.record.source === 'uploaded' ? '已上传' : '已生成'} · 正式锚点`,
    image: option.image,
    key: option.key,
    label: option.label,
    selection: option.selection,
    source: 'visual',
  })),
);
const isGenerateDisabled = computed(
  () =>
    operationDisabled.value ||
    !keyConfigured.value ||
    !selectedReferenceAsset.value ||
    !imageName.value.trim() ||
    imageName.value.length > 80 ||
    !action.value.trim() ||
    action.value.length > MAX_CHARACTER_ACTION_LENGTH,
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
    records.value = [record, ...records.value.filter(item => item.id !== record.id)].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt),
    );
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

onMounted(() => {
  void initialize();
});
</script>

<template>
  <SagPage title="角色动作" description="基于正式角色锚点生成和管理动作资产" :icon="Camera">
    <template #header-leading>
      <Badge variant="secondary" class="shrink-0 tabular-nums">{{ actionAssetCount }}</Badge>
    </template>

    <template #header-actions>
      <ActionPageHeader
        :characters="characters"
        :character-selection-disabled="characterSelectionDisabled"
        :generator-open="generatorOpen"
        :operation-disabled="operationDisabled"
        :selected-character-id="selectedCharacterId"
        @ai-create="openGenerator"
        @upload="openUpload"
        @update:selected-character-id="id => void selectCharacter(id)"
      />
    </template>

    <Alert
      v-if="!isInitializing && !hasOfficialReference"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
    >
      <AlertTitle>生成动作需要正式角色锚点</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>请先在角色锚点中上传标准参考图，或将锚点参考板设为正式资产。</span>
        <Button size="sm" variant="outline" @click="openUpload"> 上传角色锚点 </Button>
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
      <div class="flex min-h-0 min-w-0 lg:flex">
        <AnchorGallery
          :deleting-file-name="deletingFileName"
          :anchor-bindings="[]"
          :official-assets="officialAssets"
          :polling-state="pollingState"
          :records="actionRecords"
          :renaming-file-name="renamingFileName"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
          @edit="editImage"
          @official="selectAsset"
          @rename="requestRename"
        />
      </div>
      <div v-if="generatorOpen" class="flex min-h-0 min-w-0 p-3 sm:p-4 lg:flex lg:p-5">
        <CharacterActionGeneratorPanel
          v-model:action="action"
          v-model:count="count"
          v-model:name="imageName"
          v-model:resolution="resolution"
          v-model:size="size"
          :busy="busy"
          :disabled="isGenerateDisabled"
          :prompt-generation-available="promptGenerationAvailable"
          :prompt-generating="isGeneratingPrompt"
          :reference-assets="pickerOptions"
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
      :options="pickerOptions"
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
