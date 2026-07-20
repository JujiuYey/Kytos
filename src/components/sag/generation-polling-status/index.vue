<script setup lang="ts">
import { computed } from 'vue';
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';
import type { GenerationPollingPhase } from './types';

const props = withDefaults(
  defineProps<{
    attempt: number;
    class?: HTMLAttributes['class'];
    compact?: boolean;
    description?: string | null;
    phase: GenerationPollingPhase;
  }>(),
  {
    compact: false,
    description: '可以离开此页面，下次进入时会继续查询任务。',
  },
);

const statusLabel = computed(() => {
  if (props.attempt === 0) {
    return '等待首次查询';
  }
  const labels: Record<GenerationPollingPhase, string> = {
    idle: '等待首次查询',
    paused: '查询暂停',
    requesting: '正在查询任务状态',
    waiting: '等待下一次查询',
  };
  return labels[props.phase];
});

const attemptLabel = computed(() =>
  props.attempt === 0 ? '尚未查询' : `已查询 ${props.attempt} 次`,
);

function isCurrentStep(step: number): boolean {
  return props.attempt > 0 && (props.attempt - 1) % 5 === step;
}
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
      <span class="shrink-0 tabular-nums">{{ attemptLabel }}</span>
    </div>
    <div class="mt-3 flex items-center gap-1.5" aria-hidden="true">
      <span
        v-for="step in 5"
        :key="step"
        :class="[
          'size-1.5 rounded-full transition-colors duration-300',
          isCurrentStep(step - 1) ? 'bg-primary' : 'bg-muted-foreground/15',
        ]"
      />
    </div>
    <p v-if="description && !compact" class="mt-2 text-xs leading-5 text-muted-foreground">
      {{ description }}
    </p>
  </div>
</template>
