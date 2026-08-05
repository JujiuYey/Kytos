<script setup lang="ts">
import { computed } from 'vue';
import type { HTMLAttributes } from 'vue';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { GenerationPollingPhase, GenerationTaskStatus } from './types';

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    compact?: boolean;
    description?: string | null;
    phase: GenerationPollingPhase;
    progress: number;
    status: GenerationTaskStatus;
  }>(),
  {
    compact: false,
    description: '可以离开此页面，下次进入时会继续查询任务。',
  },
);

const normalizedProgress = computed(() => Math.min(100, Math.max(0, props.progress)));

const statusLabel = computed(() => {
  if (props.phase === 'paused') {
    return '进度查询已暂停';
  }
  if (props.phase === 'requesting') {
    return '正在同步生成进度';
  }
  const labels: Record<GenerationTaskStatus, string> = {
    cancelled: '生成已取消',
    completed: '生成已完成',
    failed: '生成失败',
    pending: '等待生成服务处理',
    processing: '图像生成中',
    submitted: '生成任务已提交',
  };
  return labels[props.status];
});
</script>

<template>
  <div
    :class="cn(compact ? 'w-full' : 'border-t pt-3', props.class)"
    role="status"
    aria-live="polite"
  >
    <div class="flex min-w-0 items-center justify-between gap-3 text-xs text-muted-foreground">
      <span class="flex min-w-0 items-center gap-2">
        <span class="relative flex size-2.5 shrink-0" aria-hidden="true">
          <span
            v-if="phase === 'requesting'"
            class="absolute inline-flex size-full animate-ping rounded-full bg-primary/50"
          />
          <span
            :class="[
              'relative inline-flex size-2.5 rounded-full transition-colors',
              phase === 'requesting' ? 'bg-primary' : 'bg-muted-foreground/40',
            ]"
          />
        </span>
        <span class="truncate">{{ statusLabel }}</span>
      </span>
      <span class="shrink-0 tabular-nums">{{ normalizedProgress }}%</span>
    </div>
    <Progress :model-value="normalizedProgress" class="mt-3 h-1.5" />
    <p v-if="description && !compact" class="mt-2 text-xs leading-5 text-muted-foreground">
      {{ description }}
    </p>
  </div>
</template>
