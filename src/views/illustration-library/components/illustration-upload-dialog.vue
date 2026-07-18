<script setup lang="ts">
import { ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileUpload } from '@/components/sag/file-upload';
import type { SaveFileRequest, SavedFileResult } from '@/types';

const props = defineProps<{
  open: boolean;
  uploadHandler: (request: SaveFileRequest) => Promise<SavedFileResult>;
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
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>上传已有插画</DialogTitle>
        <DialogDescription>
          图片会复制到当前作品工作区，并与创作生成的插画一起管理。
        </DialogDescription>
      </DialogHeader>

      <FileUpload
        :key="uploadKey"
        accept="image/png,image/jpeg,image/webp,image/avif"
        :max-file-size="20 * 1024 * 1024"
        :max-files="20"
        :multiple="true"
        :show-file-list="true"
        :upload-handler="uploadHandler"
        @upload-success="emit('uploaded', $event)"
      />

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">完成</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
