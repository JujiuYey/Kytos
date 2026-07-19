<script setup lang="ts">
import { Check, WandSparkles, X } from 'lucide-vue-next';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type {
  CharacterExpressionSize,
  CharacterPortraitImage,
  CharacterPortraitResolution,
  CharacterVisualAssetSelection,
} from '@/types';
import { MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES } from '@/types';

interface ExpressionReferenceAsset {
  image: CharacterPortraitImage;
  key: string;
  selection: CharacterVisualAssetSelection;
}

const props = defineProps<{
  busy: boolean;
  count: number;
  description: string;
  disabled: boolean;
  name: string;
  referenceAssets: ExpressionReferenceAsset[];
  resolution: CharacterPortraitResolution;
  selectedReferenceKeys: string[];
  size: CharacterExpressionSize;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'toggle-reference', selection: CharacterVisualAssetSelection): void;
  (event: 'update:count', value: number): void;
  (event: 'update:description', value: string): void;
  (event: 'update:name', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: CharacterExpressionSize): void;
}>();

function isReferenceSelected(key: string): boolean {
  return props.selectedReferenceKeys.includes(key);
}
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="表情生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="text-sm font-medium">创建表情</h2>
      <Button variant="ghost" size="icon" aria-label="关闭创建面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <section aria-labelledby="expression-reference-heading">
          <div class="mb-3">
            <h2 id="expression-reference-heading" class="text-sm font-medium">角色参考</h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              从当前角色的正式视觉资产中选择生成参考，不会默认全部使用。
            </p>
            <p class="mt-1 text-xs tabular-nums text-muted-foreground">
              已选择 {{ selectedReferenceKeys.length }} /
              {{ Math.min(referenceAssets.length, MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES) }}
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div v-for="(asset, index) in referenceAssets" :key="asset.key" class="min-w-0">
              <Button
                variant="outline"
                :aria-label="`${isReferenceSelected(asset.key) ? '取消选择' : '选择'}${asset.image.name || `正式资产 ${index + 1}`}`"
                :aria-pressed="isReferenceSelected(asset.key)"
                :disabled="
                  busy ||
                  (!isReferenceSelected(asset.key) &&
                    selectedReferenceKeys.length >= MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES)
                "
                :class="[
                  'relative block h-auto w-full overflow-hidden rounded-md p-0 focus-visible:ring-inset',
                  isReferenceSelected(asset.key) && 'border-primary ring-2 ring-primary/20',
                ]"
                @click="emit('toggle-reference', asset.selection)"
              >
                <AiImage
                  :alt="asset.image.name || `正式资产 ${index + 1}`"
                  :src="asset.image.url"
                  class="aspect-square w-full rounded-md bg-muted/30 object-contain"
                />
                <span
                  v-if="isReferenceSelected(asset.key)"
                  class="absolute right-2 top-2 flex size-5 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-sm"
                >
                  <Check class="size-3.5" />
                </span>
              </Button>
              <p
                :class="[
                  'mt-2 truncate text-center text-xs',
                  isReferenceSelected(asset.key)
                    ? 'font-medium text-foreground'
                    : 'text-muted-foreground',
                ]"
              >
                {{ asset.image.name || `正式资产 ${index + 1}` }}
              </p>
            </div>
            <div
              v-if="!referenceAssets.length"
              class="col-span-2 flex min-h-32 items-center justify-center rounded-md border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
            >
              缺少正式角色视觉
            </div>
          </div>
        </section>

        <section class="space-y-4" aria-labelledby="expression-content-heading">
          <h2 id="expression-content-heading" class="text-sm font-medium">表情内容</h2>
          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <Label for="expression-name">表情名称</Label>
              <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 80</span>
            </div>
            <Input
              id="expression-name"
              :model-value="name"
              maxlength="80"
              placeholder="例如：开心、委屈、震惊"
              @update:model-value="emit('update:name', String($event))"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <Label for="expression-description">表情描述</Label>
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ description.length }} / 20000
              </span>
            </div>
            <Textarea
              id="expression-description"
              :model-value="description"
              class="min-h-36 resize-y text-sm leading-6"
              maxlength="20000"
              placeholder="描述眼神、嘴角、眉毛、情绪强度和轻微姿态"
              @update:model-value="emit('update:description', String($event))"
            />
          </div>
        </section>

        <section aria-labelledby="expression-settings-heading">
          <h2 id="expression-settings-heading" class="mb-3 text-sm font-medium">输出规格</h2>
          <div class="grid grid-cols-3 gap-3">
            <div class="min-w-0 space-y-2">
              <Label for="expression-size">比例</Label>
              <Select
                :model-value="size"
                @update:model-value="emit('update:size', $event as CharacterExpressionSize)"
              >
                <SelectTrigger id="expression-size" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1</SelectItem>
                  <SelectItem value="3:4">3:4</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="min-w-0 space-y-2">
              <Label for="expression-resolution">清晰度</Label>
              <Select
                :model-value="resolution"
                @update:model-value="
                  emit('update:resolution', $event as CharacterPortraitResolution)
                "
              >
                <SelectTrigger id="expression-resolution" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1k">1K</SelectItem>
                  <SelectItem value="2k">2K</SelectItem>
                  <SelectItem value="4k">4K</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="min-w-0 space-y-2">
              <Label for="expression-count">数量</Label>
              <Select
                :model-value="String(count)"
                @update:model-value="emit('update:count', Number($event))"
              >
                <SelectTrigger id="expression-count" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 张</SelectItem>
                  <SelectItem value="2">2 张</SelectItem>
                  <SelectItem value="3">3 张</SelectItem>
                  <SelectItem value="4">4 张</SelectItem>
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
        {{ busy ? '正在生成表情' : '生成表情' }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        {{
          selectedReferenceKeys.length
            ? `使用 ${selectedReferenceKeys.length} 张已选参考图进行 GPT-Image-2 图生图，点击后将产生实际费用`
            : '请先选择至少一张正式角色参考图'
        }}
      </p>
    </footer>
  </section>
</template>
