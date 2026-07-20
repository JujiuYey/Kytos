<script setup lang="ts">
import { X } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/sag/file-upload';
import type { SaveFileRequest, SavedFileResult } from '@/types';

defineProps<{
  sourceImageName: string;
  sourceImageUrl: string;
}>();

const emit = defineEmits<{
  (event: 'removeImage'): void;
  (event: 'referenceSelected', request: SaveFileRequest): void;
  (event: 'uploadSuccess', result: SavedFileResult): void;
}>();

async function localUploadHandler(request: SaveFileRequest): Promise<SavedFileResult> {
  emit('referenceSelected', request);
  const blob = new Blob([request.fileData], { type: request.mimeType });
  return {
    fileName: request.fileName,
    originalName: request.fileName,
    size: request.fileData.byteLength,
    mimeType: request.mimeType,
    url: URL.createObjectURL(blob),
  };
}
</script>

<template>
  <section class="w-full space-y-4" aria-label="角色参考照片">
    <FileUpload
      :upload-handler="localUploadHandler"
      accept="image/*"
      :multiple="false"
      :max-files="1"
      :max-file-size="10 * 1024 * 1024"
      :show-file-list="false"
      :auto-upload="true"
      @upload-success="emit('uploadSuccess', $event)"
    />
    <div v-if="sourceImageUrl" class="flex items-center gap-3 rounded-lg border bg-background p-3">
      <img
        :src="sourceImageUrl"
        alt="已选择的角色参考图"
        class="size-16 rounded-md border object-cover"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium">{{ sourceImageName }}</p>
        <p class="mt-1 text-xs text-muted-foreground">这张照片只作为形象参考</p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="移除照片"
        title="移除照片"
        @click="emit('removeImage')"
      >
        <X class="size-4" />
      </Button>
    </div>
  </section>
</template>
