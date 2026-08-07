<script setup lang="ts">
import { X } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { usePromptInput } from '@/components/ai-elements/prompt-input';

const { files, removeFile } = usePromptInput();
</script>

<template>
  <div v-if="files.length" class="flex flex-wrap gap-2 px-3 pt-3">
    <div
      v-for="file in files"
      :key="file.id"
      class="group relative size-16 overflow-hidden rounded-md border bg-muted/20"
    >
      <AiImage
        :alt="file.filename || '待发送图片'"
        :src="file.url"
        class="size-full object-cover"
      />
      <Button
        size="icon-sm"
        variant="secondary"
        :aria-label="`移除${file.filename || '图片'}`"
        class="absolute right-0.5 top-0.5 size-5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        @click="removeFile(file.id)"
      >
        <X class="size-3" />
      </Button>
    </div>
  </div>
</template>
