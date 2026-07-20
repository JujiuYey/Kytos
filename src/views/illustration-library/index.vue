<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  Clock3,
  Image as ImageIcon,
  ImagePlus,
  Palette,
  PencilLine,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagPage } from '@/components/sag/sag-page';
import type {
  CharacterPortraitImage,
  IllustrationTopic,
  IllustrationStyleReference,
  IllustrationWorkspaceState,
  SaveFileRequest,
  SavedFileResult,
  UploadedIllustration,
} from '@/types';
import IllustrationUploadDialog from './components/illustration-upload-dialog.vue';

type IllustrationSourceFilter = 'all' | 'generated' | 'uploaded';
type IllustrationLibrarySource = Exclude<IllustrationSourceFilter, 'all'>;

interface IllustrationLibraryItem {
  createdAt: string;
  detail: string;
  id: string;
  image: CharacterPortraitImage;
  source: IllustrationLibrarySource;
  styleReference: IllustrationStyleReference;
  title: string;
  topicId: string | null;
  uploadId: string | null;
  versionId: string | null;
}

const router = useRouter();
const workspace = ref<IllustrationWorkspaceState>({
  artStyles: [],
  topics: [],
  uploads: [],
});
const sourceFilter = ref<IllustrationSourceFilter>('all');
const searchQuery = ref('');
const loading = ref(true);
const loadingError = ref('');
const uploadDialogOpen = ref(false);
const deleteTarget = ref<IllustrationLibraryItem | null>(null);
const deletingItemId = ref('');
const selectingStyleItemId = ref('');

const libraryItems = computed<IllustrationLibraryItem[]>(() => {
  const generatedItems = workspace.value.topics.flatMap(topic => getGeneratedItems(topic));
  const uploadedItems = workspace.value.uploads.map(getUploadedItem);
  return [...generatedItems, ...uploadedItems].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
});

const filteredItems = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  return libraryItems.value.filter(item => {
    const sourceMatches = sourceFilter.value === 'all' || item.source === sourceFilter.value;
    const searchMatches =
      !normalizedQuery ||
      item.title.toLocaleLowerCase('zh-CN').includes(normalizedQuery) ||
      item.detail.toLocaleLowerCase('zh-CN').includes(normalizedQuery);
    return sourceMatches && searchMatches;
  });
});

const generatedCount = computed(
  () => libraryItems.value.filter(item => item.source === 'generated').length,
);
const uploadedCount = computed(
  () => libraryItems.value.filter(item => item.source === 'uploaded').length,
);
const emptyTitle = computed(() => {
  if (searchQuery.value.trim()) {
    return '没有找到匹配的插画';
  }
  if (sourceFilter.value === 'generated') {
    return '还没有创作插画';
  }
  if (sourceFilter.value === 'uploaded') {
    return '还没有上传插画';
  }
  return '插画库还是空的';
});
const emptyDescription = computed(() => {
  if (searchQuery.value.trim()) {
    return '可以调整搜索内容，或切换来源范围。';
  }
  if (sourceFilter.value === 'generated') {
    return '在插画创作中完成的图片会自动出现在这里。';
  }
  if (sourceFilter.value === 'uploaded') {
    return '上传已有图片后，可以和创作结果一起预览和整理。';
  }
  return '上传已有插画，或从一个新的插画主题开始创作。';
});
const deleteDescription = computed(() =>
  deleteTarget.value?.source === 'generated'
    ? '该创作版本的图片会从主题和作品工作区中永久删除，此操作不可恢复。'
    : '这张上传插画会从作品工作区中永久删除，此操作不可恢复。',
);

function getGeneratedItems(topic: IllustrationTopic): IllustrationLibraryItem[] {
  return topic.versions.flatMap(version =>
    version.status === 'completed'
      ? version.images.map(image => ({
          createdAt: version.createdAt,
          detail: `${topic.title} · ${version.size} · ${version.resolution.toUpperCase()}`,
          id: `generated:${topic.id}:${version.id}:${image.fileName}`,
          image,
          source: 'generated' as const,
          styleReference: {
            fileName: image.fileName,
            source: 'generated' as const,
            topicId: topic.id,
            versionId: version.id,
          },
          title: `${topic.title} V${version.versionNumber}`,
          topicId: topic.id,
          uploadId: null,
          versionId: version.id,
        }))
      : [],
  );
}

function getUploadedItem(upload: UploadedIllustration): IllustrationLibraryItem {
  return {
    createdAt: upload.createdAt,
    detail: `${getFileType(upload.mimeType)} · ${formatFileSize(upload.size)}`,
    id: `uploaded:${upload.id}`,
    image: { fileName: upload.fileName, mimeType: upload.mimeType, url: upload.url },
    source: 'uploaded',
    styleReference: {
      fileName: upload.fileName,
      source: 'uploaded',
      uploadId: upload.id,
    },
    title: removeFileExtension(upload.originalName),
    topicId: null,
    uploadId: upload.id,
    versionId: null,
  };
}

function removeFileExtension(fileName: string): string {
  const extensionIndex = fileName.lastIndexOf('.');
  return extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
}

function getFileType(mimeType: string): string {
  const type = mimeType.split('/', 2)[1]?.toUpperCase();
  return type === 'JPEG' ? 'JPG' : type || '图片';
}

function formatFileSize(value: number): string {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function loadWorkspace(): Promise<void> {
  loading.value = true;
  loadingError.value = '';
  try {
    workspace.value = await window.desktop.getIllustrationWorkspace();
  } catch (error: unknown) {
    loadingError.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function uploadIllustration(request: SaveFileRequest): Promise<SavedFileResult> {
  return window.desktop.uploadIllustration(request);
}

async function handleUploaded(): Promise<void> {
  await loadWorkspace();
  toast.success('插画已保存到作品工作区');
}

async function selectStyleReference(item: IllustrationLibraryItem): Promise<void> {
  if (selectingStyleItemId.value) {
    return;
  }
  selectingStyleItemId.value = item.id;
  try {
    workspace.value = await window.desktop.selectIllustrationStyleReference({
      ...item.styleReference,
      name: item.title,
    });
    toast.success('已导入画风管理');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    selectingStyleItemId.value = '';
  }
}

function reviseIllustration(item: IllustrationLibraryItem): void {
  if (item.source !== 'generated' || !item.topicId || !item.versionId) {
    return;
  }
  void router.push({
    path: '/illustration',
    query: {
      revisionTopicId: item.topicId,
      revisionVersionId: item.versionId,
    },
  });
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;
  if (!target || deletingItemId.value) {
    return;
  }
  deletingItemId.value = target.id;
  try {
    if (target.source === 'uploaded' && target.uploadId) {
      workspace.value = await window.desktop.deleteIllustrationUpload({
        uploadId: target.uploadId,
      });
    } else if (target.topicId && target.versionId) {
      const updatedTopic = await window.desktop.deleteIllustrationVersion({
        topicId: target.topicId,
        versionId: target.versionId,
      });
      workspace.value = {
        ...workspace.value,
        topics: workspace.value.topics.map(topic =>
          topic.id === updatedTopic.id ? updatedTopic : topic,
        ),
      };
    }
    deleteTarget.value = null;
    toast.success('插画已删除');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    deletingItemId.value = '';
  }
}

onMounted(() => {
  void loadWorkspace();
});
</script>

<template>
  <SagPage>
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate text-sm font-semibold">插画管理</h1>
            <Badge variant="secondary" class="shrink-0 tabular-nums">
              {{ libraryItems.length }}
            </Badge>
          </div>
          <p class="hidden text-xs text-muted-foreground sm:block">统一查看、上传和整理插画资产</p>
        </div>
      </div>

      <Button class="ml-auto shrink-0" @click="uploadDialogOpen = true">
        <Upload class="size-4" />
        上传插画
      </Button>
    </template>

    <div
      class="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <Tabs
        :model-value="sourceFilter"
        @update:model-value="sourceFilter = $event as IllustrationSourceFilter"
      >
        <TabsList class="w-full sm:w-auto">
          <TabsTrigger value="all">全部 {{ libraryItems.length }}</TabsTrigger>
          <TabsTrigger value="generated">创作 {{ generatedCount }}</TabsTrigger>
          <TabsTrigger value="uploaded">上传 {{ uploadedCount }}</TabsTrigger>
        </TabsList>
      </Tabs>

      <InputGroup class="sm:w-72">
        <InputGroupAddon>
          <Search class="size-4" />
        </InputGroupAddon>
        <InputGroupInput v-model="searchQuery" placeholder="搜索名称或主题" />
      </InputGroup>
    </div>

    <Alert v-if="loadingError" variant="destructive" class="mx-4 mt-4 shrink-0 sm:mx-5">
      <AlertTitle>插画库暂时无法读取</AlertTitle>
      <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
        <span>{{ loadingError }}</span>
        <Button size="sm" variant="outline" @click="loadWorkspace">重试</Button>
      </AlertDescription>
    </Alert>

    <ScrollArea class="min-h-0 flex-1 bg-muted/10">
      <div
        v-if="loading"
        class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="index in 8"
          :key="index"
          class="overflow-hidden rounded-md border bg-background"
        >
          <Skeleton class="aspect-[4/3] w-full rounded-none" />
          <div class="space-y-3 p-3">
            <Skeleton class="h-4 w-3/5" />
            <Skeleton class="h-3 w-4/5" />
          </div>
        </article>
      </div>

      <div
        v-else-if="filteredItems.length"
        class="mx-auto grid w-full max-w-7xl grid-cols-1 gap-5 px-4 py-5 sm:grid-cols-2 sm:px-5 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="item in filteredItems"
          :key="item.id"
          class="min-w-0 overflow-hidden rounded-md border bg-background"
        >
          <ImageViewer
            :alt="item.title"
            :src="item.image.url"
            :title="item.title"
            description="查看插画大图，可缩放和拖拽"
          >
            <Button
              variant="ghost"
              class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
              :aria-label="`查看${item.title}`"
            >
              <AiImage
                :alt="item.title"
                :src="item.image.url"
                class="aspect-[4/3] w-full rounded-none bg-muted/30 object-contain transition-opacity hover:opacity-95"
              />
            </Button>
          </ImageViewer>

          <div class="space-y-2 border-t px-3 py-3">
            <div class="flex min-w-0 items-start justify-between gap-2">
              <div class="min-w-0">
                <h2 class="truncate text-sm font-medium">{{ item.title }}</h2>
                <p class="mt-1 truncate text-xs text-muted-foreground">{{ item.detail }}</p>
              </div>
              <Badge
                :variant="item.source === 'generated' ? 'secondary' : 'outline'"
                class="shrink-0"
              >
                <Sparkles v-if="item.source === 'generated'" class="size-3" />
                <Upload v-else class="size-3" />
                {{ item.source === 'generated' ? '创作' : '上传' }}
              </Badge>
            </div>

            <div class="flex items-center justify-between gap-3">
              <span class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                <Clock3 class="size-3.5 shrink-0" />
                <span class="truncate">{{ formatDate(item.createdAt) }}</span>
              </span>
              <div class="flex shrink-0 items-center gap-1">
                <Button
                  v-if="item.source === 'generated'"
                  size="sm"
                  variant="outline"
                  @click="reviseIllustration(item)"
                >
                  <PencilLine class="size-4" />
                  继续修改
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="Boolean(selectingStyleItemId)"
                  @click="selectStyleReference(item)"
                >
                  <Palette class="size-4" />
                  {{ selectingStyleItemId === item.id ? '导入中' : '导入画风' }}
                </Button>
                <TooltipProvider :delay-duration="300">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <Button
                        size="icon"
                        variant="ghost"
                        class="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                        :disabled="Boolean(deletingItemId)"
                        :aria-label="`删除${item.title}`"
                        @click="deleteTarget = item"
                      >
                        <Trash2 class="size-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent> 删除插画 </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12">
        <div class="max-w-sm text-center">
          <div
            class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
          >
            <ImageIcon class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 text-sm font-medium">{{ emptyTitle }}</h2>
          <p class="mt-1.5 text-sm leading-6 text-muted-foreground">{{ emptyDescription }}</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <Button v-if="searchQuery.trim()" variant="outline" @click="searchQuery = ''">
              清除搜索
            </Button>
            <template v-else>
              <Button variant="outline" @click="uploadDialogOpen = true">
                <Upload class="size-4" />
                上传插画
              </Button>
              <Button @click="router.push('/illustration')">
                <ImagePlus class="size-4" />
                开始创作
              </Button>
            </template>
          </div>
        </div>
      </div>
    </ScrollArea>

    <IllustrationUploadDialog
      v-model:open="uploadDialogOpen"
      :upload-handler="uploadIllustration"
      @uploaded="handleUploaded"
    />

    <SagConfirmDialog
      :open="Boolean(deleteTarget)"
      title="删除这张插画？"
      :description="deleteDescription"
      confirm-text="删除插画"
      :loading="Boolean(deletingItemId)"
      @update:open="value => !value && (deleteTarget = null)"
      @confirm="confirmDelete"
    />
  </SagPage>
</template>
