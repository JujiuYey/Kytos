<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StatusTone = 'error' | 'info' | 'neutral' | 'success' | 'warning';

const toneClasses: Record<StatusTone, string> = {
  error:
    'border-red-500/30 bg-red-500/10 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-400 [&>svg]:text-red-500',
  info: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-400 [&>svg]:text-blue-500',
  neutral: 'border-border bg-muted/50 text-muted-foreground',
  success:
    'border-green-500/30 bg-green-500/10 text-green-700 dark:border-green-500/40 dark:bg-green-500/15 dark:text-green-400 [&>svg]:text-green-500',
  warning:
    'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-400 [&>svg]:text-amber-500',
};

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    tone?: StatusTone;
  }>(),
  {
    tone: 'neutral',
  },
);
</script>

<template>
  <Badge
    data-slot="sag-status-badge"
    variant="outline"
    :class="cn(toneClasses[props.tone], props.class)"
  >
    <slot />
  </Badge>
</template>
