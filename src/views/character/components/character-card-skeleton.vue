<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton';

const skeletonAspectClasses = ['aspect-[2/3]', 'aspect-square', 'aspect-[3/4]', 'aspect-[4/5]'];

function getSkeletonAspectClass(index: number): string {
  return skeletonAspectClasses[(index - 1) % skeletonAspectClasses.length] ?? 'aspect-[3/4]';
}

defineProps<{
  index: number;
}>();
</script>

<template>
  <article
    class="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-md border bg-background align-top"
  >
    <Skeleton :class="[getSkeletonAspectClass(index), 'w-full rounded-none']" />
    <div class="space-y-3 border-t px-3 py-3">
      <Skeleton class="h-4 w-3/5" />
      <Skeleton class="h-8 w-full" />
    </div>
  </article>
</template>
