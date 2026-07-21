<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { AlertCircle } from '@lucide/vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const props = withDefaults(
  defineProps<{
    title: string;
    errorMessage: string;
    retryLabel: string;
    canRetry?: boolean;
    class?: HTMLAttributes['class'];
  }>(),
  { canRetry: true },
);

const emit = defineEmits<{
  retry: [];
}>();
</script>

<template>
  <Alert data-slot="sag-error-retry-alert" variant="destructive" :class="props.class">
    <AlertCircle class="size-4" />
    <AlertTitle>{{ props.title }}</AlertTitle>
    <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
      <span>{{ props.errorMessage }}</span>
      <Button v-if="props.canRetry" size="sm" variant="outline" @click="emit('retry')">
        {{ props.retryLabel }}
      </Button>
    </AlertDescription>
  </Alert>
</template>
