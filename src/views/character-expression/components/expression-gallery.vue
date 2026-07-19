<script setup lang="ts">
import { computed, ref } from 'vue';
import { Check, Clock3, Laugh, Pencil, Search, Trash2 } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ImageViewer } from '@/components/sag/image-viewer';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import type {
  CharacterExpressionRecord,
  CharacterLibraryCharacter,
  CharacterPortraitImage,
  CharacterPortraitTaskStatus,
} from '@/types';

const props = defineProps<{
  characters: CharacterLibraryCharacter[];
  characterSelectionDisabled: boolean;
  deletingFileName: string;
  records: CharacterExpressionRecord[];
  renamingTaskId: string;
  selectedCharacterId: string;
}>();

const emit = defineEmits<{
  (event: 'delete', record: CharacterExpressionRecord, image: CharacterPortraitImage): void;
  (event: 'rename', record: CharacterExpressionRecord): void;
  (event: 'update:selectedCharacterId', value: string): void;
}>();

const activeStatuses: CharacterPortraitTaskStatus[] = ['submitted', 'pending', 'processing'];
const searchQuery = ref('');
const filteredRecords = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  if (!normalizedQuery) {
    return props.records;
  }
  return props.records.filter(
    record =>
      record.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery) ||
      record.description.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
  );
});

function isActive(record: CharacterExpressionRecord): boolean {
  return activeStatuses.includes(record.status);
}

function getStatusLabel(record: CharacterExpressionRecord): string {
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
  <section class="flex min-h-0 flex-col bg-muted/15" aria-label="表情资产库">
    <div
      class="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <Select
        :model-value="selectedCharacterId"
        :disabled="characterSelectionDisabled"
        @update:model-value="emit('update:selectedCharacterId', String($event))"
      >
        <SelectTrigger class="w-full sm:w-56" aria-label="筛选角色">
          <SelectValue placeholder="选择角色" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="character in characters" :key="character.id" :value="character.id">
            {{ character.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <InputGroup class="w-full sm:w-72">
        <InputGroupAddon>
          <Search class="size-4" />
        </InputGroupAddon>
        <InputGroupInput v-model="searchQuery" placeholder="搜索表情名称或描述" />
      </InputGroup>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div
        v-if="filteredRecords.length"
        class="mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-5 gap-y-8 px-5 py-6 sm:grid-cols-2 xl:grid-cols-3 lg:px-8"
      >
        <template v-for="record in filteredRecords" :key="record.id">
          <article v-if="isActive(record)" class="min-w-0 rounded-md border bg-background p-4">
            <div class="flex items-center justify-between gap-3 text-sm">
              <h3 class="truncate font-medium">{{ record.name }}</h3>
              <SagStatusBadge tone="info" class="shrink-0">
                <Loader class="size-3" />
                {{ getStatusLabel(record) }}
              </SagStatusBadge>
            </div>
            <p class="mt-4 text-sm">GPT-Image-2 正在绘制这个表情</p>
            <div class="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
              <span>可以离开此页面，下次进入时会继续查询任务。</span>
              <span class="shrink-0 tabular-nums">{{ record.progress }}%</span>
            </div>
            <Progress :model-value="record.progress" class="mt-2" />
          </article>

          <article
            v-else-if="record.status === 'failed' || record.status === 'cancelled'"
            class="min-w-0 rounded-md border border-destructive/30 bg-destructive/5 p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <h3 class="truncate text-sm font-medium">{{ record.name }}</h3>
              <SagStatusBadge tone="error" class="shrink-0">
                {{ getStatusLabel(record) }}
              </SagStatusBadge>
            </div>
            <p class="mt-4 text-sm text-destructive">
              {{ record.errorMessage || '表情生成任务未完成' }}
            </p>
          </article>

          <template v-else>
            <article
              v-for="(image, imageIndex) in record.images"
              :key="image.fileName"
              class="min-w-0 overflow-hidden rounded-md border bg-background"
            >
              <ImageViewer
                :alt="`${record.name}的第 ${imageIndex + 1} 张表情预览`"
                :src="image.url"
                :title="record.name"
                description="查看表情大图，可缩放和拖拽"
              >
                <Button
                  variant="ghost"
                  class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
                  :aria-label="`查看${record.name}的第 ${imageIndex + 1} 张表情`"
                >
                  <AiImage
                    :alt="`${record.name}的第 ${imageIndex + 1} 张表情`"
                    :src="image.url"
                    :class="[
                      getAspectClass(record.size),
                      'w-full rounded-none bg-muted/30 object-contain',
                    ]"
                  />
                </Button>
              </ImageViewer>

              <div class="space-y-2 border-t px-3 py-3">
                <div class="flex min-w-0 items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-1">
                    <h3 class="truncate text-sm font-medium">{{ record.name }}</h3>
                    <TooltipProvider :delay-duration="300">
                      <Tooltip>
                        <TooltipTrigger as-child>
                          <Button
                            size="icon"
                            variant="ghost"
                            class="size-7 shrink-0 text-muted-foreground"
                            :disabled="Boolean(deletingFileName) || Boolean(renamingTaskId)"
                            :aria-label="`重命名${record.name}`"
                            @click="emit('rename', record)"
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
                    {{ getStatusLabel(record) }}
                  </SagStatusBadge>
                </div>

                <p
                  v-if="record.description"
                  class="line-clamp-2 text-xs leading-5 text-muted-foreground"
                >
                  {{ record.description }}
                </p>

                <div
                  class="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground"
                >
                  <span class="min-w-0 truncate">
                    {{ record.source === 'uploaded' ? '上传图片' : `候选 ${imageIndex + 1}` }}
                    <template v-if="record.source === 'generated'">
                      · {{ record.size }} · {{ record.resolution.toUpperCase() }}
                    </template>
                  </span>
                  <span class="flex shrink-0 items-center gap-1">
                    <Clock3 class="size-3.5" />
                    {{ formatDate(record.createdAt) }}
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
                          :disabled="Boolean(deletingFileName)"
                          :aria-label="`删除${record.name}的第 ${imageIndex + 1} 张表情`"
                          @click="emit('delete', record, image)"
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
        </template>
      </div>

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12">
        <div class="max-w-sm text-center">
          <div
            class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
          >
            <Laugh class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 text-sm font-medium">
            {{ searchQuery.trim() ? '没有找到匹配的表情' : '还没有表情' }}
          </h2>
          <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
            {{
              searchQuery.trim()
                ? '可以调整搜索内容后重试。'
                : '可以上传已有表情，或使用正式角色参考图发起生成。'
            }}
          </p>
          <Button
            v-if="searchQuery.trim()"
            class="mt-4"
            variant="outline"
            @click="searchQuery = ''"
          >
            清除搜索
          </Button>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
