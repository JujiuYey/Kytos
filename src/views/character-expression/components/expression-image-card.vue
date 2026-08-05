<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { Check, Clock3, Crop, Pencil, Trash2 } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { CharacterExpressionRecord, CharacterVisualImage } from '@/types';
import { useExpressionRecords } from '../contexts/expression-records-context';

const props = defineProps<{
  record: CharacterExpressionRecord;
  image: CharacterVisualImage;
  imageIndex: number;
}>();

const { deletingFileName, editExpression, renamingTaskId, requestDelete, requestRename } =
  useExpressionRecords();

function getAspectClass(size: CharacterExpressionRecord['size']): string {
  return {
    '1:1': 'aspect-square',
    '3:4': 'aspect-[3/4]',
    '4:5': 'aspect-[4/5]',
  }[size];
}

const formattedDate = computed(() => dayjs(props.record.createdAt).format('MM/DD HH:mm'));
const statusLabel = computed(() => (props.record.source === 'uploaded' ? '已上传' : '已完成'));
</script>

<template>
  <article class="min-w-0 overflow-hidden rounded-md border bg-background">
    <ImageViewer
      :alt="`${props.record.name}的第 ${props.imageIndex + 1} 张表情预览`"
      :src="props.image.url"
      :title="props.record.name"
      description="查看表情大图，可缩放和拖拽"
    >
      <Button
        variant="ghost"
        class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
        :aria-label="`查看${props.record.name}的第 ${props.imageIndex + 1} 张表情`"
      >
        <AiImage
          :alt="`${props.record.name}的第 ${props.imageIndex + 1} 张表情`"
          :src="props.image.url"
          :class="[
            getAspectClass(props.record.size),
            'w-full rounded-none bg-muted/30 object-contain',
          ]"
        />
      </Button>
    </ImageViewer>

    <div class="space-y-2 border-t px-3 py-3">
      <div class="flex min-w-0 items-center justify-between gap-2">
        <h3 class="truncate text-sm font-medium">{{ props.record.name }}</h3>
        <SagStatusBadge tone="success" class="shrink-0">
          <Check class="size-3" />
          {{ statusLabel }}
        </SagStatusBadge>
      </div>

      <div class="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <span class="min-w-0 truncate">
          {{ props.record.source === 'uploaded' ? '上传图片' : `AI生成` }}
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <Clock3 class="size-3.5" />
          {{ formattedDate }}
        </span>
      </div>

      <div class="flex justify-between gap-1">
        <Button
          size="sm"
          :aria-label="`编辑${props.record.name}的第 ${props.imageIndex + 1} 张表情`"
          @click="editExpression(props.record, props.image)"
        >
          <Crop class="size-4" />
          <span>编辑图片</span>
        </Button>

        <div class="flex items-center gap-1">
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 text-muted-foreground"
                  :disabled="Boolean(renamingTaskId)"
                  :aria-label="`重命名${props.record.name}`"
                  @click="requestRename(props.record)"
                >
                  <Pencil class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重命名表情</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 text-muted-foreground hover:text-destructive"
                  :disabled="Boolean(deletingFileName)"
                  :aria-label="`删除${props.record.name}的第 ${props.imageIndex + 1} 张表情`"
                  @click="requestDelete(props.record, props.image)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除表情</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  </article>
</template>
