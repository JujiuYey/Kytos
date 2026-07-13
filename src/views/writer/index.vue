<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
</script>

<template>
  <div class="h-full flex items-center justify-center p-6">
    <div class="text-center space-y-3 max-w-md">
      <Sparkles class="size-8 mx-auto text-primary" />
      <h2 class="text-lg font-semibold">
        写卡
      </h2>
      <p class="text-sm text-muted-foreground">
        让 DeepSeek 写提示词，然后回到抽卡页看图。
      </p>
      <p class="text-xs text-muted-foreground">
        这一页正在建，先用 角色 / 策略 页把上下文理顺。
      </p>
    </div>
  </div>
</template>
