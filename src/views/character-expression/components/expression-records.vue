<script setup lang="ts">
import { Loader } from '@/components/ai-elements/loader';
import {
  GenerationPollingStatus,
  type GenerationTaskPollingState,
} from '@/components/sag/generation-polling-status';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type {
  CharacterExpressionRecord,
  CharacterVisualImage,
  CharacterVisualTaskStatus,
} from '@/types';
import ExpressionImageCard from './expression-image-card.vue';

defineProps<{
  records: CharacterExpressionRecord[];
  pollingState: GenerationTaskPollingState;
}>();

const emit = defineEmits<{
  (event: 'edit', record: CharacterExpressionRecord, image: CharacterVisualImage): void;
}>();

const activeStatuses: CharacterVisualTaskStatus[] = ['submitted', 'pending', 'processing'];

function isActive(record: CharacterExpressionRecord): boolean {
  return activeStatuses.includes(record.status);
}

function getStatusLabel(record: CharacterExpressionRecord): string {
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
</script>

<template>
  <div
    class="mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-5 gap-y-8 px-5 py-6 sm:grid-cols-2 xl:grid-cols-3 lg:px-8"
  >
    <template v-for="record in records" :key="record.id">
      <article v-if="isActive(record)" class="min-w-0 rounded-md border bg-background p-4">
        <div class="flex items-center justify-between gap-3 text-sm">
          <h3 class="truncate font-medium">{{ record.name }}</h3>
          <SagStatusBadge tone="info" class="shrink-0">
            <Loader class="size-3" />
            {{ getStatusLabel(record) }}
          </SagStatusBadge>
        </div>
        <p class="mt-4 text-sm">GPT-Image-2 正在绘制这个表情</p>
        <GenerationPollingStatus
          class="mt-4"
          :attempt="pollingState.taskId === record.id ? pollingState.attempt : 0"
          :phase="pollingState.taskId === record.id ? pollingState.phase : 'waiting'"
        />
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
        <ExpressionImageCard
          v-for="(image, imageIndex) in record.images"
          :key="image.fileName"
          :record="record"
          :image="image"
          :image-index="imageIndex"
          :status-label="getStatusLabel(record)"
          @edit="(editedRecord, editedImage) => emit('edit', editedRecord, editedImage)"
        />
      </template>
    </template>
  </div>
</template>
