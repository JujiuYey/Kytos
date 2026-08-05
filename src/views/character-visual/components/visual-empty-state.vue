<script setup lang="ts">
import type { Component } from 'vue';
import { Image as ImageIcon } from '@lucide/vue';

withDefaults(
  defineProps<{
    description: string;
    icon?: Component;
    title: string;
  }>(),
  {
    icon: () => ImageIcon,
  },
);
</script>

<template>
  <div class="flex min-h-full items-center justify-center px-6 py-12">
    <div class="max-w-sm text-center">
      <div class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background">
        <component :is="icon" class="size-5 text-muted-foreground" />
      </div>
      <h2 class="mt-4 text-sm font-medium">{{ title }}</h2>
      <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
        {{ description }}
      </p>
    </div>
  </div>
</template>
