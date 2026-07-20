<script setup lang="ts">
import { ImagePlus } from '@lucide/vue';
import { PromptInputButton, usePromptInput } from '@/components/ai-elements/prompt-input';

const { openFileDialog } = usePromptInput();
</script>

<template>
  <PromptInputButton aria-label="上传人物参考图片" title="上传人物参考图片" @click="openFileDialog">
    <ImagePlus class="size-4" />
  </PromptInputButton>
</template>
