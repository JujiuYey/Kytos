<script setup lang="ts">
import { Images, LoaderCircle, Sparkles, WandSparkles, X } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Loader } from '@/components/ai-elements/loader';
import { ImageOutputSettings } from '@/components/sag/image-output-settings';
import type { ImageReferencePickerOption } from '@/components/sag/image-reference-picker-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import type { CharacterPortraitResolution, CharacterPortraitSize } from '@/types';
import { CHARACTER_PORTRAIT_SIZES, MAX_CHARACTER_ACTION_LENGTH } from '@/types';

defineProps<{
  action: string;
  busy: boolean;
  count: number;
  disabled: boolean;
  name: string;
  promptGenerationAvailable: boolean;
  promptGenerating: boolean;
  referenceAssets: ImageReferencePickerOption[];
  resolution: CharacterPortraitResolution;
  size: CharacterPortraitSize;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'generate'): void;
  (event: 'generate-prompt'): void;
  (event: 'open-reference-picker'): void;
  (event: 'update:action', value: string): void;
  (event: 'update:count', value: number): void;
  (event: 'update:name', value: string): void;
  (event: 'update:resolution', value: CharacterPortraitResolution): void;
  (event: 'update:size', value: CharacterPortraitSize): void;
}>();

const quickActions = [
  {
    description: '自然站立，抬起右手挥手，左手自然垂下。',
    name: '挥手',
  },
  {
    description: '身体略微前倾做奔跑姿势，双臂自然前后摆动。',
    name: '奔跑',
  },
  {
    description: '自然站立，双臂交叉抱在胸前。',
    name: '抱臂',
  },
  {
    description: '双脚自然分开站立，双手叉腰。',
    name: '叉腰',
  },
  {
    description: '身体自然站立，抬起一只手指向身体侧前方。',
    name: '指向前方',
  },
  {
    description: '自然站立，抬起一只手做出点赞姿势。',
    name: '点赞',
  },
] as const;

function selectQuickAction(action: (typeof quickActions)[number]): void {
  emit('update:name', action.name);
  emit('update:action', action.description);
}
</script>

<template>
  <section class="flex min-h-0 flex-col" aria-label="角色动作生成设置">
    <div class="flex h-12 shrink-0 items-center justify-between border-b px-4">
      <h2 class="text-sm font-medium">生成角色动作</h2>
      <Button variant="ghost" size="icon" aria-label="关闭生成面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-7 px-5 py-5">
        <section aria-labelledby="action-reference-heading">
          <div class="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 id="action-reference-heading" class="text-sm font-medium">正式角色视觉</h2>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">
                生成时固定角色外观，只改变姿势。
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
            v-if="referenceAssets[0]"
            class="flex items-center gap-3 rounded-md border bg-muted/15 p-2"
          >
            <AiImage
              :alt="referenceAssets[0].label"
              :src="referenceAssets[0].image.url"
              class="size-20 shrink-0 rounded-sm bg-background object-contain"
            />
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ referenceAssets[0].label }}</p>
              <p class="mt-1 truncate text-xs text-muted-foreground">
                {{ referenceAssets[0].detail }}
              </p>
            </div>
          </div>
          <div
            v-else
            class="flex min-h-24 items-center justify-center rounded-md border border-dashed px-3 text-center text-xs leading-5 text-muted-foreground"
          >
            当前角色还没有可用的正式视觉
          </div>
        </section>

        <section class="space-y-4" aria-labelledby="action-content-heading">
          <h2 id="action-content-heading" class="text-sm font-medium">动作内容</h2>

          <div class="space-y-2">
            <Label>常用动作</Label>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="item in quickActions"
                :key="item.name"
                type="button"
                size="sm"
                variant="outline"
                :disabled="busy"
                @click="selectQuickAction(item)"
              >
                {{ item.name }}
              </Button>
            </div>
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <Label for="action-name">动作名称</Label>
              <span class="text-xs tabular-nums text-muted-foreground">{{ name.length }} / 80</span>
            </div>
            <Input
              id="action-name"
              :model-value="name"
              maxlength="80"
              placeholder="例如：挥手、奔跑、抱臂"
              @update:model-value="emit('update:name', String($event))"
            />
          </div>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-3">
              <Label for="action-description">动作提示词</Label>
              <div class="flex items-center gap-2">
                <span class="text-xs tabular-nums text-muted-foreground">
                  {{ action.length }} / {{ MAX_CHARACTER_ACTION_LENGTH }}
                </span>
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
              id="action-description"
              :model-value="action"
              class="min-h-32 resize-y text-sm leading-6"
              :maxlength="MAX_CHARACTER_ACTION_LENGTH"
              placeholder="例如：自然站立，抬起右手挥手，左手自然垂下"
              @update:model-value="emit('update:action', String($event))"
            />
            <p v-if="!promptGenerationAvailable" class="text-xs text-muted-foreground">
              配置 DeepSeek API Key 后可根据动作名称生成提示词。
            </p>
          </div>
        </section>

        <ImageOutputSettings
          id-prefix="character-action"
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
        <LoaderCircle v-if="busy" class="size-4 animate-spin" />
        <WandSparkles v-else class="size-4" />
        {{ busy ? '正在生成角色动作' : `生成 ${count} 张动作图` }}
      </Button>
      <p class="mt-2 text-center text-xs text-muted-foreground">
        {{
          referenceAssets.length
            ? '使用所选正式视觉进行 GPT-Image-2 图生图，点击后将产生实际费用'
            : '请先选择一张正式角色视觉'
        }}
      </p>
    </footer>
  </section>
</template>
