<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LocalFileUpload } from '@/components/sag/local-file-upload';
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

function handleUploaded(result: SavedFileResult | SavedFileResult[]): void {
  const target = Array.isArray(result) ? result[0] : result;
  if (!target) {
    return;
  }
  emit('uploaded', target);
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

      <LocalFileUpload
        :key="uploadKey"
        accept="image/png,image/jpeg,image/webp,image/avif"
        :max-file-size="20 * 1024 * 1024"
        :max-files="20"
        :multiple="true"
        enable-drop-zone
        :upload-handler="upload"
        description="支持 PNG / JPG / WebP / AVIF，最多 20 张，单张最大 20MB"
        dropzone-hint="拖放表情到此处，或"
        label="选择表情图片"
        @upload-success="handleUploaded"
      />
    </DialogContent>
  </Dialog>
</template>
