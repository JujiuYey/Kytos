<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  title?: string;
  description?: string;
  icon?: Component;
}>();
</script>

<template>
  <main class="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <header
      v-if="$slots.header || title"
      class="flex min-h-16 shrink-0 flex-wrap items-center gap-3 border-b px-4 py-6 sm:px-5"
    >
      <slot name="header">
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <div
            v-if="icon"
            class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
          >
            <component :is="icon" class="size-4" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="truncate text-sm font-semibold">{{ title }}</h1>
              <slot name="header-leading" />
            </div>
            <p v-if="description" class="truncate text-xs text-muted-foreground">
              {{ description }}
            </p>
          </div>
        </div>

        <slot name="header-actions" />
      </slot>
    </header>

    <slot />
  </main>
</template>
