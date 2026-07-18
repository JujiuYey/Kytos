<script setup lang="ts">
import { WandSparkles, X } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
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
import type { CharacterDraft, CharacterPortraitResolution, CharacterPortraitSize } from '@/types';

defineProps<{
  busy: boolean;
  count: number;
  disabled: boolean;
  draft: CharacterDraft;
  modelValue: string;
  resolution: CharacterPortraitResolution;
  size: CharacterPortraitSize;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'update:count', value: number): void;
  (event: 'update:modelValue', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: CharacterPortraitSize): void;
}>();
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="定妆照生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="text-sm font-medium">创建定妆照</h2>
      <Button variant="ghost" size="icon" aria-label="关闭创建面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <section aria-labelledby="portrait-source-heading">
          <div class="mb-3">
            <h2 id="portrait-source-heading" class="text-sm font-medium">角色依据</h2>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              提示词已从第一步的角色草稿中整理，可在生成前继续修改。
            </p>
          </div>
          <dl class="divide-y border-y text-sm">
            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3">
              <dt class="text-muted-foreground">角色</dt>
              <dd class="break-words">{{ draft.name || '尚未命名' }}</dd>
            </div>
            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3">
              <dt class="text-muted-foreground">外形</dt>
              <dd class="line-clamp-4 whitespace-pre-wrap break-words">
                {{ draft.appearance || '第一步尚未整理外形信息' }}
              </dd>
            </div>
            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3">
              <dt class="text-muted-foreground">视觉方向</dt>
              <dd class="line-clamp-4 whitespace-pre-wrap break-words">
                {{ draft.visualDirection || '第一步尚未整理视觉方向' }}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="portrait-prompt-heading">
          <div class="mb-2 flex items-center justify-between gap-3">
            <Label id="portrait-prompt-heading" for="portrait-prompt">定妆照提示词</Label>
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ modelValue.length }} / 20000
            </span>
          </div>
          <Textarea
            id="portrait-prompt"
            :model-value="modelValue"
            class="min-h-64 resize-y text-sm leading-6"
            maxlength="20000"
            placeholder="描述角色的外形、服装、姿态、画面风格与背景"
            @update:model-value="emit('update:modelValue', String($event))"
          />
        </section>

        <section aria-labelledby="portrait-settings-heading">
          <h2 id="portrait-settings-heading" class="mb-3 text-sm font-medium">输出规格</h2>
          <div class="grid grid-cols-3 gap-3">
            <div class="min-w-0 space-y-2">
              <Label for="portrait-size">比例</Label>
              <Select
                :model-value="size"
                @update:model-value="emit('update:size', $event as CharacterPortraitSize)"
              >
                <SelectTrigger id="portrait-size" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2:3">2:3</SelectItem>
                  <SelectItem value="3:4">3:4</SelectItem>
                  <SelectItem value="4:5">4:5</SelectItem>
                  <SelectItem value="1:1">1:1</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="min-w-0 space-y-2">
              <Label for="portrait-resolution">清晰度</Label>
              <Select
                :model-value="resolution"
                @update:model-value="
                  emit('update:resolution', $event as CharacterPortraitResolution)
                "
              >
                <SelectTrigger id="portrait-resolution" class="w-full">
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
              <Label for="portrait-count">张数</Label>
              <Select
                :model-value="String(count)"
                @update:model-value="emit('update:count', Number($event))"
              >
                <SelectTrigger id="portrait-count" class="w-full">
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
        {{ busy ? '正在生成定妆照' : `生成 ${count} 张定妆照` }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        使用 GPT-Image-2，点击后将产生实际费用
      </p>
    </footer>
  </section>
</template>
