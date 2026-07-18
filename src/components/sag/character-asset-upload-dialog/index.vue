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
  description: string;
  open: boolean;
  title: string;
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

function handleUploaded(result: SavedFileResult) {
  emit('uploaded', result);
  emit('update:open', false);
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <FileUpload
        :key="uploadKey"
        accept="image/png,image/jpeg,image/webp,image/avif"
        :max-file-size="20 * 1024 * 1024"
        :max-files="1"
        :multiple="false"
        :show-file-list="true"
        :upload-handler="uploadHandler"
        @upload-success="handleUploaded"
      />
    </DialogContent>
  </Dialog>
</template>
