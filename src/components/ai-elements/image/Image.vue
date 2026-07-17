<script setup lang="ts">
import type { HTMLAttributes } from 'vue';
import { cn } from '@/lib/utils';
import { computed } from 'vue';

interface Props {
  alt?: string;
  base64?: string;
  class?: HTMLAttributes['class'];
  mediaType?: string;
  src?: string;
}

const props = defineProps<Props>();

const classes = computed(() => cn('h-auto max-w-full overflow-hidden rounded-md', props.class));

const src = computed(
  () =>
    props.src ||
    (props.mediaType && props.base64 ? `data:${props.mediaType};base64,${props.base64}` : ''),
);
</script>

<template>
  <img :alt="alt || ''" :class="classes" :src="src" v-bind="$attrs" />
</template>
