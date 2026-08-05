<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { Check, Clock3, Crop, Image as ImageIcon, Pencil, Trash2 } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  GenerationPollingStatus,
  type GenerationTaskPollingState,
} from '@/components/sag/generation-polling-status';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type {
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualTaskStatus,
} from '@/types';

interface GalleryEntryBase {
  imageIndex: number;
  key: string;
  record: CharacterVisualAssetRecord;
}

interface GalleryImageEntry extends GalleryEntryBase {
  image: CharacterVisualImage;
  type: 'image';
}

interface GalleryTaskEntry extends GalleryEntryBase {
  image: null;
  type: 'task';
}

type GalleryEntry = GalleryImageEntry | GalleryTaskEntry;

const props = defineProps<{
  deletingFileName: string;
  officialAssets: CharacterVisualAssetSelection[];
  pollingState: GenerationTaskPollingState;
  records: CharacterVisualAssetRecord[];
  renamingFileName: string;
  selectingFileName: string;
}>();

const emit = defineEmits<{
  (event: 'delete', record: CharacterVisualAssetRecord, image: CharacterVisualImage): void;
  (event: 'edit', record: CharacterVisualAssetRecord, image: CharacterVisualImage): void;
  (
    event: 'official',
    record: CharacterVisualAssetRecord,
    image: CharacterVisualImage,
    official: boolean,
  ): void;
  (event: 'rename', record: CharacterVisualAssetRecord, image: CharacterVisualImage): void;
}>();

const activeStatuses: CharacterVisualTaskStatus[] = ['submitted', 'pending', 'processing'];

const galleryEntries = computed<GalleryEntry[]>(() => createEntries(props.records));

function createEntries(records: CharacterVisualAssetRecord[]): GalleryEntry[] {
  return records.flatMap((record): GalleryEntry[] => {
    if (isActive(record) || record.status === 'failed' || record.status === 'cancelled') {
      return [
        {
          image: null,
          imageIndex: -1,
          key: `${record.id}:task`,
          record,
          type: 'task' as const,
        },
      ];
    }

    return record.images.map(
      (image, imageIndex): GalleryImageEntry => ({
        image,
        imageIndex,
        key: `${record.id}:${image.fileName}`,
        record,
        type: 'image',
      }),
    );
  });
}

function isActive(record: CharacterVisualAssetRecord): boolean {
  return activeStatuses.includes(record.status);
}

function isSelected(entry: GalleryEntry): boolean {
  if (!entry.image) {
    return false;
  }
  return props.officialAssets.some(
    asset => asset.taskId === entry.record.id && asset.fileName === entry.image?.fileName,
  );
}

function toggleOfficialStatus(entry: GalleryEntry): void {
  if (entry.type !== 'image') {
    return;
  }
  emit('official', entry.record, entry.image, !isSelected(entry));
}

function getStatusLabel(record: CharacterVisualAssetRecord): string {
  if (record.source === 'uploaded') {
    return '已上传';
  }
  const labels: Record<CharacterVisualTaskStatus, string> = {
    cancelled: '已取消',
    completed: '已完成',
    failed: '失败',
    pending: '排队中',
    processing: '生成中',
    submitted: '已提交',
  };
  return labels[record.status];
}

function getImageName(entry: GalleryEntry): string {
  return entry.image?.name || entry.record.name;
}

function getAspectClass(size: CharacterVisualAssetRecord['size']): string {
  const aspectClasses: Record<CharacterVisualAssetRecord['size'], string> = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '2:3': 'aspect-[2/3]',
    '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',
  };
  return aspectClasses[size];
}

function formatDate(value: string): string {
  const date = dayjs(value);
  return date.isValid() ? date.format('MM/DD HH:mm') : '';
}
</script>

<template>
  <section class="flex min-h-0 flex-col bg-muted/15" aria-label="角色图片资产库">
    <ScrollArea class="min-h-0 flex-1">
      <div
        v-if="galleryEntries.length"
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <article
          v-for="entry in galleryEntries"
          :key="entry.key"
          :class="[
            'mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-md border bg-background align-top',
            isSelected(entry) && 'border-primary/40 ring-1 ring-primary/10',
          ]"
        >
          <template v-if="entry.type === 'task'">
            <div class="p-4">
              <div class="flex min-w-0 items-center justify-between gap-3">
                <h2 class="truncate text-sm font-medium">{{ entry.record.name }}生成任务</h2>
                <SagStatusBadge
                  :tone="
                    entry.record.status === 'failed' || entry.record.status === 'cancelled'
                      ? 'error'
                      : 'info'
                  "
                  class="shrink-0"
                >
                  <Loader v-if="isActive(entry.record)" class="size-3" />
                  {{ getStatusLabel(entry.record) }}
                </SagStatusBadge>
              </div>

              <template v-if="isActive(entry.record)">
                <p class="mt-4 text-sm">GPT-Image-2 正在绘制“{{ entry.record.name }}”</p>
                <GenerationPollingStatus
                  class="mt-4"
                  :attempt="pollingState.taskId === entry.record.id ? pollingState.attempt : 0"
                  :phase="pollingState.taskId === entry.record.id ? pollingState.phase : 'waiting'"
                />
              </template>

              <p v-else class="mt-4 text-sm text-destructive">
                {{ entry.record.errorMessage || `${entry.record.name}生成任务未完成` }}
              </p>
            </div>
          </template>

          <template v-else-if="entry.type === 'image'">
            <ImageViewer
              :alt="`${getImageName(entry)}预览`"
              :src="entry.image.url"
              :title="getImageName(entry)"
              description="查看角色视觉大图，可缩放和拖拽"
            >
              <Button
                variant="ghost"
                class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                :aria-label="`查看${getImageName(entry)}`"
              >
                <AiImage
                  :alt="getImageName(entry)"
                  :src="entry.image.url"
                  :class="[
                    getAspectClass(entry.record.size),
                    'w-full rounded-none bg-muted/30 object-contain transition-opacity hover:opacity-95',
                  ]"
                />
              </Button>
            </ImageViewer>

            <div class="space-y-3 border-t px-3 py-3">
              <div class="min-w-0 space-y-1">
                <div class="flex min-w-0 items-start justify-between gap-2">
                  <h2 class="min-w-0 truncate text-sm font-medium">{{ getImageName(entry) }}</h2>
                  <SagStatusBadge v-if="isSelected(entry)" tone="success" class="shrink-0 gap-1">
                    <Check class="size-3" />
                    正式资产
                  </SagStatusBadge>
                  <Badge v-else variant="outline" class="shrink-0">
                    {{ entry.record.source === 'uploaded' ? '上传' : '生成' }}
                  </Badge>
                </div>
                <div
                  class="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <p class="min-w-0 truncate">
                    {{
                      entry.record.source === 'uploaded'
                        ? entry.record.originalName || '上传图片'
                        : `候选 ${entry.imageIndex + 1} · ${entry.record.size} · ${entry.record.resolution.toUpperCase()}`
                    }}
                  </p>
                  <span class="flex shrink-0 items-center gap-1">
                    <Clock3 class="size-3.5 shrink-0" />
                    <span>{{ formatDate(entry.record.createdAt) }}</span>
                  </span>
                </div>
              </div>

              <div class="flex min-w-0 items-center justify-between gap-3">
                <Button
                  size="sm"
                  :variant="isSelected(entry) ? 'secondary' : 'outline'"
                  :disabled="
                    selectingFileName === entry.image.fileName || Boolean(deletingFileName)
                  "
                  @click="toggleOfficialStatus(entry)"
                >
                  {{
                    selectingFileName === entry.image.fileName
                      ? '保存中'
                      : isSelected(entry)
                        ? '移出正式资产'
                        : '设为正式资产'
                  }}
                </Button>
                <div class="flex shrink-0 items-center gap-1.5">
                  <TooltipProvider :delay-duration="300">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground"
                          :aria-label="`编辑${getImageName(entry)}`"
                          @click="emit('edit', entry.record, entry.image)"
                        >
                          <Crop class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>编辑图片</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider :delay-duration="300">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground"
                          :disabled="Boolean(renamingFileName) || Boolean(selectingFileName)"
                          :aria-label="`重命名${getImageName(entry)}`"
                          @click="emit('rename', entry.record, entry.image)"
                        >
                          <Pencil class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>重命名图片</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider :delay-duration="300">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground hover:text-destructive"
                          :disabled="
                            isSelected(entry) ||
                            Boolean(deletingFileName) ||
                            Boolean(selectingFileName)
                          "
                          :aria-label="`删除${getImageName(entry)}`"
                          @click="emit('delete', entry.record, entry.image)"
                        >
                          <Trash2 class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {{ isSelected(entry) ? '正式资产需先移出后才能删除' : '删除图片' }}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </template>
        </article>
      </div>

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12">
        <div class="max-w-sm text-center">
          <div
            class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
          >
            <ImageIcon class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 text-sm font-medium">还没有角色图片</h2>
          <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
            可以创建或上传已有图片，建立角色的视觉资产。
          </p>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
