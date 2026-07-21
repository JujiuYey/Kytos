<script setup lang="ts">
import { Check, Clock3, Pencil, Trash2 } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { CharacterExpressionRecord, CharacterPortraitImage } from '@/types';

const props = defineProps<{
  record: CharacterExpressionRecord;
  image: CharacterPortraitImage;
  imageIndex: number;
  statusLabel: string;
  deletingFileName: string;
  renamingTaskId: string;
}>();

const emit = defineEmits<{
  (event: 'delete', record: CharacterExpressionRecord, image: CharacterPortraitImage): void;
  (event: 'rename', record: CharacterExpressionRecord): void;
}>();

function getAspectClass(size: CharacterExpressionRecord['size']): string {
  return {
    '1:1': 'aspect-square',
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
        <div class="flex min-w-0 items-center gap-1">
          <h3 class="truncate text-sm font-medium">{{ props.record.name }}</h3>
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-7 shrink-0 text-muted-foreground"
                  :disabled="Boolean(props.deletingFileName) || Boolean(props.renamingTaskId)"
                  :aria-label="`重命名${props.record.name}`"
                  @click="emit('rename', props.record)"
                >
                  <Pencil class="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>重命名表情</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <SagStatusBadge tone="success" class="shrink-0">
          <Check class="size-3" />
          {{ props.statusLabel }}
        </SagStatusBadge>
      </div>

      <p
        v-if="props.record.description"
        class="line-clamp-2 text-xs leading-5 text-muted-foreground"
      >
        {{ props.record.description }}
      </p>

      <div
        class="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground"
      >
        <span class="min-w-0 truncate">
          {{ props.record.source === 'uploaded' ? '上传图片' : `候选 ${props.imageIndex + 1}` }}
          <template v-if="props.record.source === 'generated'">
            · {{ props.record.size }} · {{ props.record.resolution.toUpperCase() }}
          </template>
        </span>
        <span class="flex shrink-0 items-center gap-1">
          <Clock3 class="size-3.5" />
          {{ formatDate(props.record.createdAt) }}
        </span>
      </div>

      <div class="flex justify-end">
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground hover:text-destructive"
                :disabled="Boolean(props.deletingFileName)"
                :aria-label="`删除${props.record.name}的第 ${props.imageIndex + 1} 张表情`"
                @click="emit('delete', props.record, props.image)"
              >
                <Trash2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>删除表情</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  </article>
</template>