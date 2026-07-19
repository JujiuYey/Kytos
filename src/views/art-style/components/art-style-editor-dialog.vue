<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Image as ImageIcon } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/sag/file-upload';
import type { ArtStyle, SaveArtStyleRequest } from '@/types';

const props = defineProps<{
  loading: boolean;
  open: boolean;
  style: ArtStyle | null;
}>();

const emit = defineEmits<{
  (event: 'save', request: SaveArtStyleRequest): void;
  (event: 'update:open', value: boolean): void;
}>();

const name = ref('');
const description = ref('');
const prompt = ref('');
const selectedFile = ref<File | null>(null);
const removeExistingReference = ref(false);
const uploadKey = ref(0);
const valid = computed(() => Boolean(name.value.trim() && prompt.value.trim()));

watch(
  () => props.open,
  open => {
    if (!open) {
      return;
    }
    name.value = props.style?.name ?? '';
    description.value = props.style?.description ?? '';
    prompt.value = props.style?.prompt ?? '';
    selectedFile.value = null;
    removeExistingReference.value = false;
    uploadKey.value += 1;
  },
);

function handleFileChange(files: File[]): void {
  selectedFile.value = files[0] ?? null;
  if (selectedFile.value) {
    removeExistingReference.value = false;
  }
}

function clearSelectedFile(): void {
  selectedFile.value = null;
  uploadKey.value += 1;
}

async function save(): Promise<void> {
  if (!valid.value || props.loading) {
    return;
  }
  let referenceImage: SaveArtStyleRequest['referenceImage'];
  if (selectedFile.value) {
    referenceImage = {
      fileData: new Uint8Array(await selectedFile.value.arrayBuffer()),
      fileName: selectedFile.value.name,
      mimeType: selectedFile.value.type,
    };
  } else if (removeExistingReference.value) {
    referenceImage = null;
  }
  emit('save', {
    description: description.value.trim(),
    id: props.style?.id,
    name: name.value.trim(),
    prompt: prompt.value.trim(),
    referenceImage,
  });
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="flex h-[min(760px,calc(100vh-2rem))] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
    >
      <DialogHeader class="shrink-0 border-b px-6 py-5">
        <DialogTitle>{{ style ? '编辑画风' : '新增画风' }}</DialogTitle>
        <DialogDescription>画风规则会用于插画创作和故事分镜，参考图可选。</DialogDescription>
      </DialogHeader>

      <ScrollArea class="min-h-0 flex-1">
        <div class="grid min-h-full md:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
          <div class="space-y-5 px-6 py-5 md:border-r">
            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <Label for="art-style-name">画风名称</Label>
                <span class="text-xs tabular-nums text-muted-foreground">
                  {{ name.length }} / 80
                </span>
              </div>
              <Input
                id="art-style-name"
                v-model="name"
                maxlength="80"
                placeholder="例如：柔和水彩"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <Label for="art-style-description">简短说明</Label>
                <span class="text-xs tabular-nums text-muted-foreground">
                  {{ description.length }} / 500
                </span>
              </div>
              <Textarea
                id="art-style-description"
                v-model="description"
                class="min-h-24 resize-none"
                maxlength="500"
                placeholder="说明这个画风适合什么内容"
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between gap-3">
                <Label for="art-style-prompt">生图规则</Label>
                <span class="text-xs tabular-nums text-muted-foreground">
                  {{ prompt.length }} / 20000
                </span>
              </div>
              <Textarea
                id="art-style-prompt"
                v-model="prompt"
                class="min-h-64 resize-none leading-6"
                maxlength="20000"
                placeholder="描述线条、上色、材质、光影、色彩和禁止项"
              />
            </div>
          </div>

          <div class="space-y-4 bg-muted/10 px-6 py-5">
            <div>
              <Label>参考图（可选）</Label>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                用于补充线条、上色和材质语言，不会替代左侧的生图规则。
              </p>
            </div>
            <div
              v-if="style?.referenceImage && !removeExistingReference && !selectedFile"
              class="overflow-hidden rounded-md border bg-background"
            >
              <AiImage
                :src="style.referenceImage.url"
                :alt="style.name"
                class="aspect-[4/3] w-full rounded-none bg-muted/30 object-contain"
              />
              <div class="flex items-center gap-3 border-t p-3">
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium">当前参考图</p>
                  <p class="mt-1 text-xs text-muted-foreground">保存后继续使用这张图片</p>
                </div>
                <Button variant="outline" size="sm" @click="removeExistingReference = true">
                  移除
                </Button>
              </div>
            </div>
            <div
              v-if="selectedFile"
              class="flex items-center gap-3 rounded-md border bg-background p-3"
            >
              <ImageIcon class="size-5 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ selectedFile.name }}</p>
                <p class="mt-1 text-xs text-muted-foreground">保存后替换当前参考图</p>
              </div>
              <Button variant="outline" size="sm" @click="clearSelectedFile">移除</Button>
            </div>
            <FileUpload
              v-else
              :key="uploadKey"
              :auto-upload="false"
              accept="image/png,image/jpeg,image/webp,image/avif"
              :max-file-size="20 * 1024 * 1024"
              :max-files="1"
              :multiple="false"
              :show-file-list="false"
              :show-progress="false"
              class="[&>div:first-child]:min-h-64 [&>div:first-child]:rounded-md [&>div:first-child]:bg-background [&>div:first-child]:p-5"
              @file-change="handleFileChange"
            />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="shrink-0 border-t px-6 py-4">
        <Button variant="outline" :disabled="loading" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="loading || !valid" @click="save">
          {{ loading ? '保存中' : '保存画风' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
