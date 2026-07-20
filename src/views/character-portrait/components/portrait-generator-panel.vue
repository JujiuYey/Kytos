<script setup lang="ts">
import { WandSparkles, X } from '@lucide/vue';
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
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import type {
  ArtStyle,
  CharacterDraft,
  CharacterPortraitResolution,
  CharacterPortraitSize,
} from '@/types';
import { CHARACTER_PORTRAIT_SIZES } from '@/types';

defineProps<{
  artStyleId: string;
  artStyles: ArtStyle[];
  busy: boolean;
  count: number;
  disabled: boolean;
  draft: CharacterDraft;
  modelValue: string;
  name: string;
  resolution: CharacterPortraitResolution;
  size: CharacterPortraitSize;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'update:artStyleId', value: string): void;
  (event: 'update:count', value: number): void;
  (event: 'update:modelValue', value: string): void;
  (event: 'update:name', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: CharacterPortraitSize): void;
}>();
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="角色视觉生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="text-sm font-medium">从描述创建</h2>
      <Button variant="ghost" size="icon" aria-label="关闭创建面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <div class="space-y-2">
          <Label for="portrait-name">图片名称</Label>
          <Input
            id="portrait-name"
            :model-value="name"
            maxlength="80"
            placeholder="例如：定妆照、日常造型、战斗形态"
            @update:model-value="emit('update:name', String($event))"
          />
        </div>
        <div class="space-y-2">
          <Label for="portrait-art-style">画风</Label>
          <Select
            :model-value="artStyleId || undefined"
            :disabled="busy"
            @update:model-value="emit('update:artStyleId', String($event))"
          >
            <SelectTrigger id="portrait-art-style" class="w-full">
              <SelectValue placeholder="选择画风" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="style in artStyles" :key="style.id" :value="style.id">
                {{ style.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
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
              <dt class="text-muted-foreground">视觉总述</dt>
              <dd class="line-clamp-4 whitespace-pre-wrap break-words">
                {{ draft.visualSummary || '角色共创尚未整理视觉总述' }}
              </dd>
            </div>
            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3">
              <dt class="text-muted-foreground">形象锚点</dt>
              <dd class="line-clamp-4 whitespace-pre-wrap break-words">
                {{ draft.faceAnchor || draft.hairAnchor || '角色共创尚未整理脸部与发型锚点' }}
              </dd>
            </div>
            <div class="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-3">
              <dt class="text-muted-foreground">视觉表现</dt>
              <dd class="line-clamp-4 whitespace-pre-wrap break-words">
                {{ draft.visualMedium || draft.lineAndShape || '角色共创尚未整理视觉表现' }}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="portrait-prompt-heading">
          <div class="mb-2 flex items-center justify-between gap-3">
            <Label id="portrait-prompt-heading" for="portrait-prompt">图片提示词</Label>
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ modelValue.length }} / 20000
            </span>
          </div>
          <Textarea
            id="portrait-prompt"
            :model-value="modelValue"
            class="min-h-64 resize-y text-sm leading-6"
            maxlength="20000"
            placeholder="补充本次视觉探索希望强调的气质、姿态或其他约束"
            @update:model-value="emit('update:modelValue', String($event))"
          />
        </section>

        <ImageOutputSettings
          id-prefix="portrait"
          :count="count"
          :disabled="busy"
          :resolution="resolution"
          :size="size"
          :size-options="CHARACTER_PORTRAIT_SIZES"
          @update:count="emit('update:count', $event)"
          @update:resolution="emit('update:resolution', $event)"
          @update:size="emit('update:size', $event as CharacterPortraitSize)"
        />
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button class="w-full" :disabled="disabled" @click="emit('generate')">
        <WandSparkles class="size-4" />
        {{ busy ? '正在生成图片' : `生成 ${count} 张图片` }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        使用 GPT-Image-2，点击后将产生实际费用
      </p>
    </footer>
  </section>
</template>
