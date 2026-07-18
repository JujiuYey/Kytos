<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

const name = ref('');
const uploadKey = ref(0);
const normalizedName = computed(() => name.value.trim());

watch(
  () => props.open,
  open => {
    if (open) {
      name.value = '';
      uploadKey.value += 1;
    }
  },
);

function upload(request: SaveFileRequest): Promise<SavedFileResult> {
  if (!normalizedName.value) {
    return Promise.reject(new Error('请先填写表情名称'));
  }
  return props.uploadHandler(normalizedName.value, request);
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
        <DialogDescription
          >填写名称并上传一张已有表情，图片会保存到当前作品工作区。</DialogDescription
        >
      </DialogHeader>

      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="upload-expression-name">表情名称</Label>
          <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 80</span>
        </div>
        <Input
          id="upload-expression-name"
          v-model="name"
          maxlength="80"
          placeholder="例如：开心、委屈、震惊"
        />
      </div>

      <FileUpload
        v-if="normalizedName"
        :key="uploadKey"
        accept="image/png,image/jpeg,image/webp,image/avif"
        :max-file-size="20 * 1024 * 1024"
        :max-files="1"
        :multiple="false"
        :show-file-list="true"
        :upload-handler="upload"
        @upload-success="handleUploaded"
      />
      <div
        v-else
        class="flex min-h-36 items-center justify-center rounded-md border border-dashed px-6 text-center text-sm text-muted-foreground"
      >
        填写表情名称后即可选择图片
      </div>
    </DialogContent>
  </Dialog>
</template>
