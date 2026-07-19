<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { IllustrationVersion } from '@/types';

const props = defineProps<{
  busy: boolean;
  open: boolean;
  version: IllustrationVersion | null;
}>();

const emit = defineEmits<{
  (event: 'confirm', prompt: string): void;
  (event: 'update:open', value: boolean): void;
}>();

const prompt = ref('');
const sourceImage = computed(() => props.version?.images[0] ?? null);
const canConfirm = computed(() => Boolean(sourceImage.value && prompt.value.trim()));

watch(
  () => [props.open, props.version?.id] as const,
  ([open]) => {
    if (open) {
      prompt.value = '';
    }
  },
);

function confirm(): void {
  if (!canConfirm.value || props.busy) {
    return;
  }
  emit('confirm', prompt.value.trim());
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-3xl gap-0 overflow-hidden p-0">
      <DialogHeader class="border-b px-6 py-5">
        <DialogTitle>基于 V{{ version?.versionNumber }} 修改</DialogTitle>
        <DialogDescription>原插画作为修改底稿，未指定的画面内容保持不变。</DialogDescription>
      </DialogHeader>

      <div class="grid min-w-0 gap-5 px-6 py-5 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <div class="min-w-0 overflow-hidden rounded-md border bg-muted/20">
          <AiImage
            v-if="sourceImage"
            :alt="`V${version?.versionNumber} 修改底稿`"
            :src="sourceImage.url"
            class="aspect-square w-full bg-background object-contain"
          />
        </div>

        <div class="min-w-0 space-y-2">
          <Label for="illustration-revision-prompt">修改要求</Label>
          <Textarea
            id="illustration-revision-prompt"
            v-model="prompt"
            class="min-h-52 resize-none text-sm leading-6"
            maxlength="20000"
            placeholder="例如：把人物表情改得更开心，其他内容保持不变"
            @keydown.meta.enter.prevent="confirm"
            @keydown.ctrl.enter.prevent="confirm"
          />
          <p class="text-right text-xs tabular-nums text-muted-foreground">
            {{ prompt.length }} / 20000
          </p>
        </div>
      </div>

      <DialogFooter class="border-t bg-background px-6 py-4">
        <Button variant="outline" :disabled="busy" @click="emit('update:open', false)">
          取消
        </Button>
        <Button :disabled="busy || !canConfirm" @click="confirm">
          {{ busy ? '正在生成修改版本' : '生成修改版本' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
