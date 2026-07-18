<script setup lang="ts">
import { Camera, Check, Clock3, Images, Trash2 } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ImageViewer } from '@/components/sag/image-viewer';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type {
  CharacterImageRecord,
  CharacterPortraitImage,
  CharacterPortraitSelection,
  CharacterPortraitTaskStatus,
} from '@/types';

defineProps<{
  assetKind: 'portrait' | 'sheet';
  deletingFileName: string;
  records: CharacterImageRecord[];
  selectedImage: CharacterPortraitSelection | null;
  selectingFileName: string;
}>();

const emit = defineEmits<{
  (event: 'delete', record: CharacterImageRecord, image: CharacterPortraitImage): void;
  (event: 'select', record: CharacterImageRecord, image: CharacterPortraitImage): void;
}>();

const activeStatuses: CharacterPortraitTaskStatus[] = ['submitted', 'pending', 'processing'];

function isActive(record: CharacterImageRecord): boolean {
  return activeStatuses.includes(record.status);
}

function isSelected(
  selection: CharacterPortraitSelection | null,
  record: CharacterImageRecord,
  image: CharacterPortraitImage,
): boolean {
  return selection?.taskId === record.id && selection.fileName === image.fileName;
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

function getAspectClass(size: CharacterImageRecord['size']): string {
  return {
    '1:1': 'aspect-square',
    '16:9': 'aspect-video',
    '2:3': 'aspect-[2/3]',
    '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',
  }[size];
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
  <section
    class="flex min-h-0 flex-col bg-muted/15"
    :aria-label="assetKind === 'portrait' ? '定妆照候选' : '角色表候选'"
  >
    <div class="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-background px-5">
      <div class="min-w-0">
        <h2 class="truncate text-sm font-medium">
          {{ assetKind === 'portrait' ? '定妆照资产' : '多角度角色表' }}
        </h2>
        <p class="mt-0.5 text-xs text-muted-foreground">生成和上传的图片都会保存到作品工作区</p>
      </div>
      <Badge variant="outline">{{ records.length }} 项记录</Badge>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div v-if="records.length" class="mx-auto w-full max-w-5xl space-y-8 px-5 py-6 lg:px-8">
        <article v-for="record in records" :key="record.id">
          <header class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <Badge
                :variant="
                  record.status === 'failed' || record.status === 'cancelled'
                    ? 'destructive'
                    : 'secondary'
                "
              >
                <Loader v-if="isActive(record)" class="size-3" />
                <Check v-else-if="record.status === 'completed'" class="size-3" />
                {{ getStatusLabel(record) }}
              </Badge>
              <span v-if="record.source === 'generated'" class="text-xs text-muted-foreground">
                {{ record.size }} · {{ record.resolution.toUpperCase() }} · {{ record.count }} 张
              </span>
              <span v-else class="max-w-64 truncate text-xs text-muted-foreground">
                {{ record.originalName || '本地上传图片' }}
              </span>
            </div>
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 class="size-3.5" />
              {{ formatDate(record.createdAt) }}
            </span>
          </header>

          <div v-if="isActive(record)" class="rounded-md border bg-background p-5">
            <div class="flex items-center justify-between gap-4 text-sm">
              <span>
                GPT-Image-2 正在绘制{{ assetKind === 'portrait' ? '定妆照' : '角色表' }}
              </span>
              <span class="tabular-nums text-muted-foreground">{{ record.progress }}%</span>
            </div>
            <Progress :model-value="record.progress" class="mt-3" />
            <p class="mt-3 text-xs text-muted-foreground">
              可以离开此页面，下次进入时会继续查询任务。
            </p>
          </div>

          <div
            v-else-if="record.status === 'failed' || record.status === 'cancelled'"
            class="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {{
              record.errorMessage ||
              `${assetKind === 'portrait' ? '定妆照' : '角色表'}生成任务未完成`
            }}
          </div>

          <div
            v-else-if="record.images.length"
            class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <figure
              v-for="(image, imageIndex) in record.images"
              :key="image.fileName"
              class="overflow-hidden rounded-md border bg-background"
            >
              <ImageViewer
                :alt="`${record.id} 的第 ${imageIndex + 1} 张${assetKind === 'portrait' ? '定妆照' : '角色表'}预览`"
                :src="image.url"
                :title="assetKind === 'portrait' ? '定妆照预览' : '角色表预览'"
                :description="`查看${assetKind === 'portrait' ? '定妆照' : '角色表'}大图，可缩放和拖拽`"
              >
                <Button
                  variant="ghost"
                  class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                  :aria-label="`查看第 ${imageIndex + 1} 张${assetKind === 'portrait' ? '定妆照' : '角色表'}`"
                >
                  <AiImage
                    :alt="`${record.id} 的第 ${imageIndex + 1} 张${assetKind === 'portrait' ? '定妆照' : '角色表'}`"
                    :src="image.url"
                    :class="[
                      getAspectClass(record.size),
                      'w-full rounded-none bg-muted/30 object-contain',
                    ]"
                  />
                </Button>
              </ImageViewer>

              <figcaption
                class="flex min-h-12 items-center justify-between gap-3 border-t px-3 py-2"
              >
                <span class="truncate text-xs text-muted-foreground">
                  {{ record.source === 'uploaded' ? '上传图片' : `候选 ${imageIndex + 1}` }}
                </span>
                <div class="flex shrink-0 items-center gap-1.5">
                  <Badge
                    v-if="isSelected(selectedImage, record, image)"
                    variant="secondary"
                    class="gap-1"
                  >
                    <Check class="size-3" />
                    已选定
                  </Badge>
                  <Button
                    v-else
                    size="sm"
                    variant="outline"
                    :disabled="selectingFileName === image.fileName || Boolean(deletingFileName)"
                    @click="emit('select', record, image)"
                  >
                    {{
                      selectingFileName === image.fileName
                        ? '保存中'
                        : assetKind === 'portrait'
                          ? '设为定妆照'
                          : '设为角色表'
                    }}
                  </Button>
                  <TooltipProvider :delay-duration="300">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <Button
                          size="icon"
                          variant="ghost"
                          class="size-8 text-muted-foreground hover:text-destructive"
                          :disabled="Boolean(deletingFileName) || Boolean(selectingFileName)"
                          :aria-label="`删除第 ${imageIndex + 1} 张${assetKind === 'portrait' ? '定妆照' : '角色表'}`"
                          @click="emit('delete', record, image)"
                        >
                          <Trash2 class="size-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        删除{{ assetKind === 'portrait' ? '定妆照' : '角色表' }}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </figcaption>
            </figure>
          </div>
        </article>
      </div>

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12">
        <div class="max-w-sm text-center">
          <div
            class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
          >
            <Camera v-if="assetKind === 'portrait'" class="size-5 text-muted-foreground" />
            <Images v-else class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 text-sm font-medium">
            还没有{{ assetKind === 'portrait' ? '定妆照' : '角色表' }}
          </h2>
          <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
            可以从左侧上传已有图片，或确认设置后发起生成。
          </p>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
