<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileUpload } from '@/components/sag/file-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CharacterVisualAssetUpload, SaveFileRequest, SavedFileResult } from '@/types';

const props = defineProps<{
  description: string;
  open: boolean;
  title: string;
  uploadHandler: (request: CharacterVisualAssetUpload) => Promise<SavedFileResult>;
}>();

const emit = defineEmits<{
  (event: 'uploaded', result: SavedFileResult): void;
  (event: 'update:open', value: boolean): void;
}>();

const uploadKey = ref(0);
const name = ref('角色视觉');
const normalizedName = computed(() => name.value.trim());

watch(
  () => props.open,
  open => {
    if (open) {
      uploadKey.value += 1;
      name.value = '角色视觉';
    }
  },
);

function handleUploaded(result: SavedFileResult) {
  emit('uploaded', result);
  emit('update:open', false);
}

function upload(request: SaveFileRequest): Promise<SavedFileResult> {
  if (!normalizedName.value) {
    return Promise.reject(new Error('请先填写图片名称'));
  }
  return props.uploadHandler({ ...request, name: normalizedName.value });
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="character-visual-name">图片名称</Label>
          <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 80</span>
        </div>
        <Input
          id="character-visual-name"
          v-model="name"
          maxlength="80"
          placeholder="例如：基础形象、冬季造型、挥手动作"
        />
      </div>
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
