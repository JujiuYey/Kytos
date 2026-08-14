<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { PanelsTopLeft } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagMissingPrerequisiteAlert } from '@/components/sag/missing-prerequisite-alert';
import { SagPage } from '@/components/sag/sag-page';
import { characterAnchorApi } from '@/lib/character-anchor-api';
import type {
  CharacterAnchorRecord,
  CharacterVisualResolution,
  CharacterVisualSize,
} from '@/types';
import type { GeneratedAnchorRole } from './components/character-anchor-generator-panel.vue';
import { useCharacterWorkspace } from './composables/useCharacterWorkspace';
import AnchorGallery from './components/anchor-gallery.vue';
import AnchorPageHeader from './components/anchor-page-header.vue';
import CharacterAnchorGeneratorPanel from './components/character-anchor-generator-panel.vue';
import AnchorAssetRenameDialog from './components/anchor-asset-rename-dialog.vue';
import AnchorUploadDialog from './components/anchor-upload-dialog.vue';

const isSubmitting = ref(false);
const busy = computed(() => isSubmitting.value);

const {
  activeRecord,
  anchorBindings,
  characters,
  characterSelectionDisabled,
  deleteAsset,
  deleteDialogOpen,
  deleteTarget,
  deletingFileName,
  editImage,
  errorMessage,
  initialize,
  isInitializing,
  isPolling,
  keyConfigured,
  officialAssets,
  openUpload,
  operationDisabled,
  pollingState,
  records,
  referenceOptions,
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
  selectingFileName,
  setAnchorRole,
  startPolling,
  uploadDialogOpen,
  handleUploaded,
} = useCharacterWorkspace({
  busy,
  onWorkspaceApplied: () => {
    resumeActivePolling();
  },
  returnTo: 'character-anchor',
});

const anchorGeneratorOpen = ref(false);
const anchorResolution = ref<CharacterVisualResolution>('1k');
const selectedAnchorRoles = ref<GeneratedAnchorRole[]>([]);

const anchorRecords = computed(() =>
  records.value.filter(record => record.generationMode !== 'action'),
);
const assetCount = computed(() =>
  anchorRecords.value.reduce((total, record) => total + record.images.length, 0),
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

interface StandardReferenceOption {
  detail: string;
  image: import('@/types').CharacterVisualImage;
  key: string;
  label: string;
  selection: import('@/types').CharacterAnchorSelection;
  source: 'visual';
}

const standardReference = computed<StandardReferenceOption | undefined>(() => {
  const priority = (taskId: string, fileName: string): number => {
    const role = anchorBindings.value.find(
      binding => binding.taskId === taskId && binding.fileName === fileName,
    )?.role;
    return role === 'full-body' ? 0 : role === 'face' ? 1 : role === 'three-quarter' ? 2 : 3;
  };
  return [...referenceOptions.value]
    .sort(
      (left, right) =>
        priority(left.selection.taskId, left.selection.fileName) -
        priority(right.selection.taskId, right.selection.fileName),
    )
    .map(option => ({
      detail: `${option.record.source === 'uploaded' ? '已上传' : '已生成'} · ${
        anchorBindings.value.find(
          binding =>
            binding.taskId === option.selection.taskId &&
            binding.fileName === option.selection.fileName,
        )?.role ?? '未指定职责'
      }`,
      image: option.image,
      key: option.key,
      label: option.label,
      selection: option.selection,
      source: 'visual' as const,
    }))[0];
});

const isAnchorGenerateDisabled = computed(
  () =>
    isInitializing.value ||
    busy.value ||
    Boolean(activeRecord.value) ||
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

function openAnchorGenerator(): void {
  if (operationDisabled.value) return;
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
      records.value = [record, ...records.value.filter(item => item.id !== record.id)].sort(
        (left, right) => right.createdAt.localeCompare(left.createdAt),
      );
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
  startPolling(firstRecord.id);
}

onMounted(() => {
  void initialize();
});
</script>

<template>
  <SagPage
    title="角色锚点"
    description="从标准参考图生成可复用的角色身份锚点"
    :icon="PanelsTopLeft"
  >
    <template #header-leading>
      <Badge variant="secondary" class="shrink-0 tabular-nums">{{ assetCount }}</Badge>
    </template>

    <template #header-actions>
      <AnchorPageHeader
        :characters="characters"
        :character-selection-disabled="characterSelectionDisabled"
        :generator-open="anchorGeneratorOpen"
        :operation-disabled="operationDisabled"
        :selected-character-id="selectedCharacterId"
        @anchor-create="openAnchorGenerator"
        @upload="openUpload"
        @update:selected-character-id="id => void selectCharacter(id)"
      />
    </template>

    <section
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

    <SagMissingPrerequisiteAlert
      v-if="!isInitializing && !keyConfigured"
      class="mx-4 mt-3 w-auto shrink-0 sm:mx-5"
      title="生成图片需要 APIMart API Key"
      description="上传已有角色锚点图片不受影响。"
      action-label="前往设置"
      to="/settings"
    />

    <Alert v-if="errorMessage" variant="destructive" class="mx-4 mt-3 w-auto shrink-0 sm:mx-5">
      <AlertTitle>角色锚点生成暂时中断</AlertTitle>
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
        anchorGeneratorOpen && 'lg:grid-cols-[minmax(0,5fr)_minmax(340px,2fr)]',
      ]"
    >
      <div class="flex min-h-0 min-w-0 lg:flex">
        <AnchorGallery
          :deleting-file-name="deletingFileName"
          :anchor-bindings="anchorBindings"
          :official-assets="officialAssets"
          :polling-state="pollingState"
          :records="anchorRecords"
          :renaming-file-name="renamingFileName"
          :selecting-file-name="selectingFileName"
          class="min-h-0 min-w-0 flex-1"
          @delete="requestDelete"
          @edit="editImage"
          @official="selectAsset"
          @rename="requestRename"
          @role="setAnchorRole"
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
    </div>

    <AnchorUploadDialog
      v-model:open="uploadDialogOpen"
      :character-id="selectedCharacterId"
      @uploaded="handleUploaded"
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
