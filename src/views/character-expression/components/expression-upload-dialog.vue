<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/sag/file-upload';
import type { SaveFileRequest, SavedFileResult } from '@/types';

const props = defineProps<{
  open: boolean;
  uploadHandler: (name: string, request: SaveFileRequest) => Promise<SavedFileResult>;
}>();

const emit = defineEmits<{
  (event: 'uploaded', result: SavedFileResult): void;
  (event: 'update:open', value: boolean): void;
}>();

const uploadKey = ref(0);

watch(
  () => props.open,
  open => {
    if (open) {
      uploadKey.value += 1;
    }
  },
);

function upload(request: SaveFileRequest): Promise<SavedFileResult> {
  const extensionIndex = request.fileName.lastIndexOf('.');
  const fileNameWithoutExtension =
    extensionIndex > 0 ? request.fileName.slice(0, extensionIndex) : request.fileName;
  const expressionName = fileNameWithoutExtension.trim().slice(0, 80).trim() || '未命名表情';
  return props.uploadHandler(expressionName, request);
}

function handleUploaded(result: SavedFileResult) {
  emit('uploaded', result);
  emit('update:open', false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>上传表情</DialogTitle>
        <DialogDescription>
          上传一张已有表情，文件名会自动作为表情名称并保存到当前作品工作区。
        </DialogDescription>
      </DialogHeader>

      <FileUpload
        :key="uploadKey"
        accept="image/png,image/jpeg,image/webp,image/avif"
        :max-file-size="20 * 1024 * 1024"
        :max-files="1"
        :multiple="false"
        :show-file-list="true"
        :upload-handler="upload"
        @upload-success="handleUploaded"
      />
    </DialogContent>
  </Dialog>
</template>
