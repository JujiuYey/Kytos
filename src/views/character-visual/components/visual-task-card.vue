<script setup lang="ts">
import { Loader } from '@/components/ai-elements/loader';
import {
  GenerationPollingStatus,
  type GenerationTaskPollingState,
} from '@/components/sag/generation-polling-status';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { CharacterVisualAssetRecord, CharacterVisualTaskStatus } from '@/types';

const props = defineProps<{
  pollingState: GenerationTaskPollingState;
  record: CharacterVisualAssetRecord;
}>();

const activeStatuses: CharacterVisualTaskStatus[] = ['submitted', 'pending', 'processing'];

const statusLabels: Record<CharacterVisualTaskStatus, string> = {
  cancelled: '已取消',
  completed: '已完成',
  failed: '失败',
  pending: '排队中',
  processing: '生成中',
  submitted: '已提交',
};

function isActive(record: CharacterVisualAssetRecord): boolean {
  return activeStatuses.includes(record.status);
}

function getStatusLabel(record: CharacterVisualAssetRecord): string {
  if (record.source === 'uploaded') {
    return '已上传';
  }
  return statusLabels[record.status];
}
</script>

<template>
  <div class="p-4">
    <div class="flex min-w-0 items-center justify-between gap-3">
      <h2 class="truncate text-sm font-medium">{{ props.record.name }}生成任务</h2>
      <SagStatusBadge
        :tone="
          props.record.status === 'failed' || props.record.status === 'cancelled' ? 'error' : 'info'
        "
        class="shrink-0"
      >
        <Loader v-if="isActive(props.record)" class="size-3" />
        {{ getStatusLabel(props.record) }}
      </SagStatusBadge>
    </div>

    <template v-if="isActive(props.record)">
      <p class="mt-4 text-sm">GPT-Image-2 正在绘制“{{ props.record.name }}”</p>
      <GenerationPollingStatus
        class="mt-4"
        :phase="
          props.pollingState.taskId === props.record.id ? props.pollingState.phase : 'waiting'
        "
        :progress="props.record.progress"
        :status="props.record.status"
      />
    </template>

    <p v-else class="mt-4 text-sm text-destructive">
      {{ props.record.errorMessage || `${props.record.name}生成任务未完成` }}
    </p>
  </div>
</template>
