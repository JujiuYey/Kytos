<script setup lang="ts">
import { computed } from 'vue';
import { Check, Clock3, Image as ImageIcon, Trash2 } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import type {
  CharacterImageRecord,
  CharacterPortraitImage,
  CharacterPortraitRecord,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
  CharacterSheetRecord,
} from '@/types';

type AssetKind = 'portrait' | 'sheet';

interface GalleryEntry {
  image: CharacterPortraitImage | null;
  imageIndex: number;
  key: string;
  kind: AssetKind;
  record: CharacterImageRecord;
  type: 'image' | 'task';
}

const props = defineProps<{
  deletingFileName: string;
  portraitRecords: CharacterPortraitRecord[];
  selectedImage: CharacterPortraitSelection | null;
  selectedSheet: CharacterPortraitSelection | null;
  selectingFileName: string;
  sheetRecords: CharacterSheetRecord[];
}>();

const emit = defineEmits<{
  (
    event: 'delete',
    kind: AssetKind,
    record: CharacterImageRecord,
    image: CharacterPortraitImage,
  ): void;
  (
    event: 'select',
    kind: AssetKind,
    record: CharacterImageRecord,
    image: CharacterPortraitImage,
  ): void;
}>();

const activeStatuses: CharacterPortraitTaskStatus[] = ['submitted', 'pending', 'processing'];

const galleryEntries = computed<GalleryEntry[]>(() =>
  [
    ...createEntries('portrait', props.portraitRecords),
    ...createEntries('sheet', props.sheetRecords),
  ].sort((left, right) => right.record.createdAt.localeCompare(left.record.createdAt)),
);

function createEntries(kind: AssetKind, records: CharacterImageRecord[]): GalleryEntry[] {
  return records.flatMap((record): GalleryEntry[] => {
    if (isActive(record) || record.status === 'failed' || record.status === 'cancelled') {
      return [
        {
          image: null,
          imageIndex: -1,
          key: `${kind}:${record.id}:task`,
          kind,
          record,
          type: 'task' as const,
        },
      ];
    }

    return record.images.map((image, imageIndex) => ({
      image,
      imageIndex,
      key: `${kind}:${record.id}:${image.fileName}`,
      kind,
      record,
      type: 'image' as const,
    }));
  });
}

function isActive(record: CharacterImageRecord): boolean {
  return activeStatuses.includes(record.status);
}

function isSelected(entry: GalleryEntry): boolean {
  if (!entry.image) {
    return false;
  }
  const selection = entry.kind === 'portrait' ? props.selectedImage : props.selectedSheet;
  return selection?.taskId === entry.record.id && selection.fileName === entry.image.fileName;
}

function getStatusLabel(record: CharacterImageRecord): string {
  if (record.source === 'uploaded') {
    return '已上传';
  }
  const labels: Record<CharacterPortraitTaskStatus, string> = {
    cancelled: '已取消',
    completed: '已完成',
    failed: '失败',
    pending: '排队中',
    processing: '生成中',
    submitted: '已提交',
  };
  return labels[record.status];
}

function getAssetLabel(kind: AssetKind): string {
  return kind === 'portrait' ? '定妆照' : '角色表';
}

function getAspectClass(size: CharacterImageRecord['size']): string {
  const aspectClasses: Record<CharacterImageRecord['size'], string> = {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '2:3': 'aspect-[2/3]',
    '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',
  };
  return aspectClasses[size];
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
  }).format(date);
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
                <h2 class="truncate text-sm font-medium">
                  {{ getAssetLabel(entry.kind) }}生成任务
                </h2>
                <Badge
                  :variant="
                    entry.record.status === 'failed' || entry.record.status === 'cancelled'
                      ? 'destructive'
                      : 'secondary'
                  "
                  class="shrink-0"
                >
                  <Loader v-if="isActive(entry.record)" class="size-3" />
                  {{ getStatusLabel(entry.record) }}
                </Badge>
              </div>

              <template v-if="isActive(entry.record)">
                <p class="mt-4 text-sm">GPT-Image-2 正在绘制{{ getAssetLabel(entry.kind) }}</p>
                <div
                  class="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground"
                >
                  <span>可以离开此页面，下次进入时会继续查询任务。</span>
                  <span class="shrink-0 tabular-nums">{{ entry.record.progress }}%</span>
                </div>
                <Progress :model-value="entry.record.progress" class="mt-2" />
              </template>

              <p v-else class="mt-4 text-sm text-destructive">
                {{ entry.record.errorMessage || `${getAssetLabel(entry.kind)}生成任务未完成` }}
              </p>
            </div>
          </template>

          <template v-else-if="entry.image">
            <ImageViewer
              :alt="`${getAssetLabel(entry.kind)}候选 ${entry.imageIndex + 1} 预览`"
              :src="entry.image.url"
              :title="`${getAssetLabel(entry.kind)}预览`"
              :description="`查看${getAssetLabel(entry.kind)}大图，可缩放和拖拽`"
            >
              <Button
                variant="ghost"
                class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                :aria-label="`查看${getAssetLabel(entry.kind)}候选 ${entry.imageIndex + 1}`"
              >
                <AiImage
                  :alt="`${getAssetLabel(entry.kind)}候选 ${entry.imageIndex + 1}`"
                  :src="entry.image.url"
                  :class="[
                    getAspectClass(entry.record.size),
                    'w-full rounded-none bg-muted/30 object-contain transition-opacity hover:opacity-95',
                  ]"
                />
              </Button>
            </ImageViewer>

            <div class="space-y-3 border-t px-3 py-3">
              <div class="flex min-w-0 items-start justify-between gap-2">
                <div class="min-w-0">
                  <h2 class="truncate text-sm font-medium">{{ getAssetLabel(entry.kind) }}</h2>
                  <p class="mt-1 truncate text-xs text-muted-foreground">
                    {{
                      entry.record.source === 'uploaded'
                        ? entry.record.originalName || '上传图片'
                        : `候选 ${entry.imageIndex + 1} · ${entry.record.size} · ${entry.record.resolution.toUpperCase()}`
                    }}
                  </p>
                </div>
                <Badge v-if="isSelected(entry)" variant="secondary" class="shrink-0 gap-1">
                  <Check class="size-3" />
                  正式资产
                </Badge>
                <Badge v-else variant="outline" class="shrink-0">
                  {{ entry.record.source === 'uploaded' ? '上传' : '生成' }}
                </Badge>
              </div>

              <div class="flex min-w-0 items-center justify-between gap-3">
                <span class="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 class="size-3.5 shrink-0" />
                  <span class="truncate">{{ formatDate(entry.record.createdAt) }}</span>
                </span>
                <div class="flex shrink-0 items-center gap-1.5">
                  <Button
                    v-if="!isSelected(entry)"
                    size="sm"
                    variant="outline"
                    :disabled="
                      selectingFileName === entry.image.fileName || Boolean(deletingFileName)
                    "
                    @click="emit('select', entry.kind, entry.record, entry.image)"
                  >
                    {{ selectingFileName === entry.image.fileName ? '保存中' : '设为正式资产' }}
                  </Button>
                  <TooltipProvider :delay-duration="300">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground hover:text-destructive"
                          :disabled="Boolean(deletingFileName) || Boolean(selectingFileName)"
                          :aria-label="`删除这张${getAssetLabel(entry.kind)}`"
                          @click="emit('delete', entry.kind, entry.record, entry.image)"
                        >
                          <Trash2 class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>删除{{ getAssetLabel(entry.kind) }}</TooltipContent>
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
            可以通过 AI 创建或上传已有图片，建立角色的视觉资产。
          </p>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
