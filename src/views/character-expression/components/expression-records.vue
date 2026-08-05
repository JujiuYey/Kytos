<script setup lang="ts">
import { Loader } from '@/components/ai-elements/loader';
import {
  GenerationPollingStatus,
  type GenerationTaskPollingState,
} from '@/components/sag/generation-polling-status';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type {
  CharacterExpressionRecord,
  CharacterExpressionTask,
  CharacterVisualImage,
  CharacterVisualTaskStatus,
} from '@/types';
import ExpressionImageCard from './expression-image-card.vue';

defineProps<{
  records: CharacterExpressionRecord[];
  pollingState: GenerationTaskPollingState;
  tasks: CharacterExpressionTask[];
}>();

const emit = defineEmits<{
  (event: 'edit', record: CharacterExpressionRecord, image: CharacterVisualImage): void;
}>();

const activeStatuses: CharacterVisualTaskStatus[] = ['submitted', 'pending', 'processing'];

function isActive(task: CharacterExpressionTask): boolean {
  return activeStatuses.includes(task.status);
}

function getTaskStatusLabel(task: CharacterExpressionTask): string {
  const labels: Record<CharacterVisualTaskStatus, string> = {
    cancelled: '已取消',
    completed: '已完成',
    failed: '失败',
    pending: '排队中',
    processing: '生成中',
    submitted: '已提交',
  };
  return labels[task.status];
}

function getRecordStatusLabel(record: CharacterExpressionRecord): string {
  return record.source === 'uploaded' ? '已上传' : '已完成';
}
</script>

<template>
  <div
    class="mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-5 gap-y-8 px-5 py-6 sm:grid-cols-2 xl:grid-cols-3 lg:px-8"
  >
    <template v-for="task in tasks" :key="task.id">
      <article v-if="isActive(task)" class="min-w-0 rounded-md border bg-background p-4">
        <div class="flex items-center justify-between gap-3 text-sm">
          <h3 class="truncate font-medium">{{ task.name }}</h3>
          <SagStatusBadge tone="info" class="shrink-0">
            <Loader class="size-3" />
            {{ getTaskStatusLabel(task) }}
          </SagStatusBadge>
        </div>
        <p class="mt-4 text-sm">GPT-Image-2 正在绘制这个表情</p>
        <GenerationPollingStatus
          class="mt-4"
          :attempt="pollingState.taskId === task.id ? pollingState.attempt : 0"
          :phase="pollingState.taskId === task.id ? pollingState.phase : 'waiting'"
        />
      </article>

      <article v-else class="min-w-0 rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <div class="flex items-center justify-between gap-3">
          <h3 class="truncate text-sm font-medium">{{ task.name }}</h3>
          <SagStatusBadge tone="error" class="shrink-0">
            {{ getTaskStatusLabel(task) }}
          </SagStatusBadge>
        </div>
        <p class="mt-4 text-sm text-destructive">
          {{ task.errorMessage || '表情生成任务未完成' }}
        </p>
      </article>
    </template>

    <template v-for="record in records" :key="record.id">
      <ExpressionImageCard
        v-for="(image, imageIndex) in record.images"
        :key="image.fileName"
        :record="record"
        :image="image"
        :image-index="imageIndex"
        :status-label="getRecordStatusLabel(record)"
        @edit="(editedRecord, editedImage) => emit('edit', editedRecord, editedImage)"
      />
    </template>
  </div>
</template>
