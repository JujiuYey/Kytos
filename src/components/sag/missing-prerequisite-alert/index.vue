<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { useRouter } from 'vue-router';
import { AlertCircle } from '@lucide/vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const props = defineProps<{
  title: string;
  description: string;
  actionLabel: string;
  to: string;
  class?: HTMLAttributes['class'];
}>();

const router = useRouter();

function go() {
  router.push(props.to);
}
</script>

<template>
  <Alert data-slot="sag-missing-prerequisite-alert" :class="props.class">
    <AlertCircle class="size-4" />
    <AlertTitle>{{ props.title }}</AlertTitle>
    <AlertDescription class="flex flex-wrap items-center justify-between gap-2">
      <span>{{ props.description }}</span>
      <Button size="sm" variant="outline" @click="go">
        {{ props.actionLabel }}
      </Button>
    </AlertDescription>
  </Alert>
</template>
