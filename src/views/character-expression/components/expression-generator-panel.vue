<script setup lang="ts">
import { WandSparkles, X } from 'lucide-vue-next';
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
import { ImageViewer } from '@/components/sag/image-viewer';
import type {
  CharacterExpressionSize,
  CharacterPortraitImage,
  CharacterPortraitResolution,
} from '@/types';

defineProps<{
  busy: boolean;
  count: number;
  description: string;
  disabled: boolean;
  name: string;
  referencePortrait: CharacterPortraitImage | null;
  referenceSheet: CharacterPortraitImage | null;
  resolution: CharacterPortraitResolution;
  size: CharacterExpressionSize;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'update:count', value: number): void;
  (event: 'update:description', value: string): void;
  (event: 'update:name', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: CharacterExpressionSize): void;
}>();
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="表情生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="text-sm font-medium">AI 创建表情</h2>
      <Button variant="ghost" size="icon" aria-label="关闭 AI 创建面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <section aria-labelledby="expression-reference-heading">
          <div class="mb-3">
            <h2 id="expression-reference-heading" class="text-sm font-medium">角色参考</h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              同时参考正式定妆照和角色表，锁定角色身份、造型与画风。
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="min-w-0">
              <ImageViewer
                v-if="referencePortrait"
                alt="正式定妆照预览"
                :src="referencePortrait.url"
                title="正式定妆照"
                description="表情生成使用的身份与画风参考"
              >
                <Button
                  variant="ghost"
                  class="block h-auto w-full rounded-md border p-0 focus-visible:ring-inset"
                  aria-label="查看正式定妆照"
                >
                  <AiImage
                    alt="正式定妆照"
                    :src="referencePortrait.url"
                    class="aspect-square w-full rounded-md bg-muted/30 object-contain"
                  />
                </Button>
              </ImageViewer>
              <div
                v-else
                class="flex aspect-square items-center justify-center rounded-md border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
              >
                缺少正式定妆照
              </div>
              <p class="mt-2 truncate text-center text-xs text-muted-foreground">定妆照</p>
            </div>

            <div class="min-w-0">
              <ImageViewer
                v-if="referenceSheet"
                alt="正式角色表预览"
                :src="referenceSheet.url"
                title="正式角色表"
                description="表情生成使用的完整造型与结构参考"
              >
                <Button
                  variant="ghost"
                  class="block h-auto w-full rounded-md border p-0 focus-visible:ring-inset"
                  aria-label="查看正式角色表"
                >
                  <AiImage
                    alt="正式角色表"
                    :src="referenceSheet.url"
                    class="aspect-square w-full rounded-md bg-muted/30 object-contain"
                  />
                </Button>
              </ImageViewer>
              <div
                v-else
                class="flex aspect-square items-center justify-center rounded-md border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
              >
                缺少正式角色表
              </div>
              <p class="mt-2 truncate text-center text-xs text-muted-foreground">角色表</p>
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
        使用两张正式角色参考图进行 GPT-Image-2 图生图，点击后将产生实际费用
      </p>
    </footer>
  </section>
</template>
