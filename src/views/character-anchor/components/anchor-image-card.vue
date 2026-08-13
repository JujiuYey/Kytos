<script setup lang="ts">
import { computed } from 'vue';
import dayjs from 'dayjs';
import { Check, Clock3, Crop, Pencil, Trash2 } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { CharacterAnchorBinding, CharacterAnchorRecord, CharacterVisualImage } from '@/types';

const props = defineProps<{
  deletingFileName: string;
  image: CharacterVisualImage;
  imageIndex: number;
  isSelected: boolean;
  anchorRole: CharacterAnchorBinding['role'];
  record: CharacterAnchorRecord;
  renamingFileName: string;
  selectingFileName: string;
}>();

const emit = defineEmits<{
  (event: 'delete'): void;
  (event: 'edit'): void;
  (event: 'official', official: boolean): void;
  (event: 'role', role: CharacterAnchorBinding['role']): void;
  (event: 'rename'): void;
}>();

const aspectClasses: Record<CharacterAnchorRecord['size'], string> = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '2:3': 'aspect-[2/3]',
  '3:4': 'aspect-[3/4]',
  '4:5': 'aspect-[4/5]',
};

const imageName = computed(() => props.image.name || props.record.name);
const isOfficialToggleDisabled = computed(
  () => props.selectingFileName === props.image.fileName || Boolean(props.deletingFileName),
);
const isRenameDisabled = computed(
  () =>
    Boolean(props.renamingFileName) ||
    Boolean(props.selectingFileName) ||
    Boolean(props.deletingFileName),
);
const isDeleteDisabled = computed(
  () => props.isSelected || Boolean(props.deletingFileName) || Boolean(props.selectingFileName),
);
const isOfficialSaving = computed(() => props.selectingFileName === props.image.fileName);
const anchorRoleOptions = [
  { label: '不指定职责', value: 'unassigned' },
  { label: '标准参考图', value: 'standard' },
  { label: '角色转面图', value: 'turnaround' },
  { label: '脸部与发型', value: 'face' },
  { label: '全身与服装', value: 'full-body' },
  { label: '四分之三视角', value: 'three-quarter' },
  { label: '侧面视角', value: 'side' },
  { label: '背面视角', value: 'back' },
] as const;

function getAspectClass(size: CharacterAnchorRecord['size']): string {
  return aspectClasses[size];
}

function formatDate(value: string): string {
  const date = dayjs(value);
  return date.isValid() ? date.format('MM/DD HH:mm') : '';
}
</script>

<template>
  <ImageViewer
    :alt="`${imageName}预览`"
    :src="props.image.url"
    :title="imageName"
    description="查看角色锚点大图，可缩放和拖拽"
  >
    <Button
      variant="ghost"
      class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
      :aria-label="`查看${imageName}`"
    >
      <AiImage
        :alt="imageName"
        :src="props.image.url"
        :class="[
          getAspectClass(props.record.size),
          'w-full rounded-none bg-muted/30 object-contain transition-opacity hover:opacity-95',
        ]"
      />
    </Button>
  </ImageViewer>

  <div class="space-y-3 border-t px-3 py-3">
    <div class="min-w-0 space-y-1">
      <div class="flex min-w-0 items-start justify-between gap-2">
        <h2 class="min-w-0 truncate text-sm font-medium">{{ imageName }}</h2>
        <SagStatusBadge v-if="props.isSelected" tone="success" class="shrink-0 gap-1">
          <Check class="size-3" />
          正式资产
        </SagStatusBadge>
        <Badge v-else variant="outline" class="shrink-0">
          {{ props.record.source === 'uploaded' ? '上传' : '生成' }}
        </Badge>
      </div>
      <div class="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground">
        <p class="min-w-0 truncate">
          {{
            props.record.source === 'uploaded'
              ? props.record.originalName || '上传图片'
              : `候选 ${props.imageIndex + 1} · ${props.record.size} · ${props.record.resolution.toUpperCase()}`
          }}
        </p>
        <span class="flex shrink-0 items-center gap-1">
          <Clock3 class="size-3.5 shrink-0" />
          <span>{{ formatDate(props.record.createdAt) }}</span>
        </span>
      </div>
    </div>

    <div class="flex min-w-0 items-center justify-between gap-3">
      <Button
        size="sm"
        :variant="props.isSelected ? 'secondary' : 'outline'"
        :disabled="isOfficialToggleDisabled"
        @click="emit('official', !props.isSelected)"
      >
        {{ isOfficialSaving ? '保存中' : props.isSelected ? '移出正式资产' : '设为正式资产' }}
      </Button>
      <div class="flex shrink-0 items-center gap-1.5">
        <TooltipProvider :delay-duration="300">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="icon"
                variant="ghost"
                class="size-8 text-muted-foreground"
                :aria-label="`编辑${imageName}`"
                @click="emit('edit')"
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
                :disabled="isRenameDisabled"
                :aria-label="`重命名${imageName}`"
                @click="emit('rename')"
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
                :disabled="isDeleteDisabled"
                :aria-label="`删除${imageName}`"
                @click="emit('delete')"
              >
                <Trash2 class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ props.isSelected ? '正式资产需先移出后才能删除' : '删除图片' }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>

    <div v-if="props.isSelected" class="space-y-1.5">
      <p class="text-xs text-muted-foreground">身份锚点职责</p>
      <Select
        :model-value="props.anchorRole"
        :disabled="isOfficialToggleDisabled"
        @update:model-value="emit('role', String($event) as CharacterAnchorBinding['role'])"
      >
        <SelectTrigger class="h-8 w-full text-xs" aria-label="选择身份锚点职责">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in anchorRoleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>
