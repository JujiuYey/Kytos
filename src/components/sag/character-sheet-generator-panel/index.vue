<script setup lang="ts">
import { WandSparkles, X } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ImageViewer } from '@/components/sag/image-viewer';
import type { CharacterPortraitImage, CharacterPortraitResolution } from '@/types';

defineProps<{
  busy: boolean;
  disabled: boolean;
  modelValue: string;
  name: string;
  referenceImage: CharacterPortraitImage | null;
  resolution: CharacterPortraitResolution;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'update:modelValue', value: string): void;
  (event: 'update:name', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
}>();
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="参考图生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="text-sm font-medium">基于正式资产创建</h2>
      <Button variant="ghost" size="icon" aria-label="关闭创建面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <div class="space-y-2">
          <Label for="sheet-name">图片名称</Label>
          <Input
            id="sheet-name"
            :model-value="name"
            maxlength="80"
            placeholder="例如：角色表、服装细节、背面设定"
            @update:model-value="emit('update:name', String($event))"
          />
        </div>
        <section aria-labelledby="sheet-reference-heading">
          <div class="mb-3">
            <h2 id="sheet-reference-heading" class="text-sm font-medium">正式角色视觉</h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              新图片会以这张正式资产作为参考，保持角色外形和画风一致。
            </p>
          </div>
          <ImageViewer
            v-if="referenceImage"
            :alt="'正式角色视觉预览'"
            :src="referenceImage.url"
            title="正式角色视觉"
            description="新图片生成所使用的参考图"
          >
            <Button
              variant="ghost"
              class="block h-auto w-full rounded-md border p-0 focus-visible:ring-inset"
              aria-label="查看正式角色视觉"
            >
              <AiImage
                alt="正式角色视觉"
                :src="referenceImage.url"
                class="aspect-[2/3] max-h-80 w-full rounded-md bg-muted/30 object-contain"
              />
            </Button>
          </ImageViewer>
          <div
            v-else
            class="flex min-h-40 items-center justify-center rounded-md border border-dashed px-5 text-center text-sm text-muted-foreground"
          >
            请先将至少一张角色视觉图片设为正式资产
          </div>
        </section>

        <section aria-labelledby="sheet-prompt-heading">
          <div class="mb-2 flex items-center justify-between gap-3">
            <Label id="sheet-prompt-heading" for="sheet-prompt">图片提示词</Label>
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ modelValue.length }} / 20000
            </span>
          </div>
          <Textarea
            id="sheet-prompt"
            :model-value="modelValue"
            class="min-h-64 resize-y text-sm leading-6"
            maxlength="20000"
            placeholder="描述需要的正面、侧面、背面和局部视图"
            @update:model-value="emit('update:modelValue', String($event))"
          />
        </section>

        <section aria-labelledby="sheet-settings-heading">
          <h2 id="sheet-settings-heading" class="mb-3 text-sm font-medium">输出规格</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="min-w-0 space-y-2">
              <Label>比例</Label>
              <div class="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">
                16:9
              </div>
            </div>
            <div class="min-w-0 space-y-2">
              <Label for="sheet-resolution">清晰度</Label>
              <Select
                :model-value="resolution"
                @update:model-value="
                  emit('update:resolution', $event as CharacterPortraitResolution)
                "
              >
                <SelectTrigger id="sheet-resolution" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1k">1K</SelectItem>
                  <SelectItem value="2k">2K</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button class="w-full" :disabled="disabled" @click="emit('generate')">
        <WandSparkles class="size-4" />
        {{ busy ? '正在生成图片' : `生成“${name}”` }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        使用正式角色视觉进行 GPT-Image-2 图生图，点击后将产生实际费用
      </p>
    </footer>
  </section>
</template>
