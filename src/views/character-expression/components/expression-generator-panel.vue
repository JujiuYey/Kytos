<script setup lang="ts">
import { Images, Sparkles, WandSparkles, X } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterExpressionSize, CharacterPortraitResolution } from '@/types';
import { CHARACTER_EXPRESSION_SIZES } from '@/types';
import type { ExpressionReferenceOption } from '../expression-reference';

defineProps<{
  busy: boolean;
  count: number;
  description: string;
  disabled: boolean;
  name: string;
  promptGenerationAvailable: boolean;
  promptGenerating: boolean;
  referenceAssets: ExpressionReferenceOption[];
  resolution: CharacterPortraitResolution;
  size: CharacterExpressionSize;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'generate-prompt'): void;
  (event: 'open-reference-picker'): void;
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
      <h2 class="text-sm font-medium">创建表情</h2>
      <Button variant="ghost" size="icon" aria-label="关闭创建面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <section aria-labelledby="expression-reference-heading">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="expression-reference-heading" class="text-sm font-medium">角色参考</h2>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                可选择当前角色的视觉资产或已有表情。
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              :disabled="busy"
              @click="emit('open-reference-picker')"
            >
              <Images class="size-4" />
              {{ referenceAssets.length ? '更换参考' : '选择参考' }}
            </Button>
          </div>

          <div
            v-if="referenceAssets.length"
            class="grid grid-cols-4 gap-2 rounded-md border bg-muted/15 p-2"
          >
            <div v-for="asset in referenceAssets.slice(0, 4)" :key="asset.key" class="min-w-0">
              <AiImage
                :alt="asset.label"
                :src="asset.image.url"
                class="aspect-square w-full rounded-sm bg-background object-contain"
              />
              <p class="mt-1 truncate text-center text-xs text-muted-foreground">
                {{ asset.label }}
              </p>
            </div>
          </div>
          <div
            v-else
            class="flex min-h-24 items-center justify-center rounded-md border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
          >
            尚未选择参考图片
          </div>
          <p v-if="referenceAssets.length > 4" class="mt-2 text-xs text-muted-foreground">
            另有 {{ referenceAssets.length - 4 }} 张已选参考
          </p>
        </section>

        <section class="space-y-4" aria-labelledby="expression-content-heading">
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
              <Label for="expression-description">表情提示词</Label>
              <div class="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  :disabled="busy || promptGenerating || !promptGenerationAvailable || !name.trim()"
                  @click="emit('generate-prompt')"
                >
                  <Loader v-if="promptGenerating" class="size-4" />
                  <Sparkles v-else class="size-4" />
                  {{ promptGenerating ? '生成中' : '生成提示词' }}
                </Button>
              </div>
            </div>
            <Textarea
              id="expression-description"
              :model-value="description"
              class="min-h-36 resize-y text-sm leading-6"
              maxlength="20000"
              placeholder="描述眉眼、嘴部、情绪强度和轻微姿态"
              @update:model-value="emit('update:description', String($event))"
            />
            <p v-if="!promptGenerationAvailable" class="text-xs text-muted-foreground">
              配置 DeepSeek API Key 后可根据表情名称生成提示词。
            </p>
            <p class="text-xs tabular-nums text-muted-foreground text-right">
              {{ description.length }} / 20000
            </p>
          </div>
        </section>

        <ImageOutputSettings
          id-prefix="expression"
          :count="count"
          :disabled="busy"
          :resolution="resolution"
          :size="size"
          :size-options="CHARACTER_EXPRESSION_SIZES"
          @update:count="emit('update:count', $event)"
          @update:resolution="emit('update:resolution', $event)"
          @update:size="emit('update:size', $event as CharacterExpressionSize)"
        />
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button class="w-full" :disabled="disabled" @click="emit('generate')">
        <WandSparkles class="size-4" />
        {{ busy ? '正在生成表情' : '生成表情' }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        {{
          referenceAssets.length
            ? `使用 ${referenceAssets.length} 张已选参考图进行 GPT-Image-2 图生图，点击后将产生实际费用`
            : '请先选择至少一张角色参考图'
        }}
      </p>
    </footer>
  </section>
</template>
