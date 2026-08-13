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
import { characterAnchorApi } from '@/lib/character-anchor-api';
import type { SaveFileRequest, SavedFileResult } from '@/types';

const props = defineProps<{
  characterId: string;
}>();

const open = defineModel<boolean>('open', { required: true });

const emit = defineEmits<{
  (event: 'uploaded', result: SavedFileResult): void;
}>();

const uploadKey = ref(0);
const name = ref('标准参考图');
const normalizedName = computed(() => name.value.trim());

watch(open, value => {
  if (value) {
    uploadKey.value += 1;
    name.value = '标准参考图';
  }
});

function upload(request: SaveFileRequest): Promise<SavedFileResult> {
  if (!normalizedName.value) {
    return Promise.reject(new Error('请先填写图片名称'));
  }
  return characterAnchorApi.uploadAnchor({
    ...request,
    characterId: props.characterId,
    name: normalizedName.value,
  });
}

function handleUploaded(result: SavedFileResult): void {
  emit('uploaded', result);
  open.value = false;
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>上传角色锚点图片</DialogTitle>
        <DialogDescription>
          上传一张人物标准图，后续可从它生成角色转面图和其他身份锚点。
        </DialogDescription>
      </DialogHeader>
      <div class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <Label for="anchor-asset-name">图片名称</Label>
          <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 80</span>
        </div>
        <Input
          id="anchor-asset-name"
          v-model="name"
          maxlength="80"
          placeholder="例如：标准参考图、冬季造型"
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
