<script setup lang="ts">
import { Loader } from '@/components/ai-elements/loader';
import {
  GenerationPollingStatus,
  type GenerationTaskPollingState,
} from '@/components/sag/generation-polling-status';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { CharacterExpressionTask } from '@/types';

const props = defineProps<{
  pollingState: GenerationTaskPollingState;
  task: CharacterExpressionTask;
}>();

const activeStatuses: CharacterExpressionTask['status'][] = ['submitted', 'pending', 'processing'];

const statusLabels: Record<CharacterExpressionTask['status'], string> = {
  cancelled: '已取消',
  failed: '失败',
  pending: '排队中',
  processing: '生成中',
  submitted: '已提交',
};

function isActive(task: CharacterExpressionTask): boolean {
  return activeStatuses.includes(task.status);
}
</script>

<template>
  <div class="p-4">
    <div class="flex min-w-0 items-center justify-between gap-3">
      <h2 class="truncate text-sm font-medium">{{ props.task.name }}生成任务</h2>
      <SagStatusBadge :tone="isActive(props.task) ? 'info' : 'error'" class="shrink-0">
        <Loader v-if="isActive(props.task)" class="size-3" />
        {{ statusLabels[props.task.status] }}
      </SagStatusBadge>
    </div>

    <template v-if="isActive(props.task)">
      <p class="mt-4 text-sm">GPT-Image-2 正在绘制“{{ props.task.name }}”</p>
      <GenerationPollingStatus
        class="mt-4"
        :attempt="props.pollingState.taskId === props.task.id ? props.pollingState.attempt : 0"
        :phase="props.pollingState.taskId === props.task.id ? props.pollingState.phase : 'waiting'"
      />
    </template>

    <p v-else class="mt-4 text-sm text-destructive">
      {{ props.task.errorMessage || `${props.task.name}生成任务未完成` }}
    </p>
  </div>
</template>
