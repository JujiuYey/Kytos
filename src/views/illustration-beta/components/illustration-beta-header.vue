<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
</script>

<template>
  <div class="flex min-w-0 flex-1 items-center gap-3">
    <div
      class="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
    >
      <Sparkles class="size-4" />
    </div>
    <div class="hidden min-w-0 sm:block">
      <h1 class="truncate text-sm font-semibold">插画创作 Beta</h1>
      <p class="truncate text-xs text-muted-foreground">通过节点画布编排参考图与生成</p>
    </div>
  </div>
</template>
