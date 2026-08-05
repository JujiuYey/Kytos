<script setup lang="ts">
import { Check, History, ImageUpscale, LoaderCircle } from '@lucide/vue';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import type { CharacterVisualImage, CharacterVisualGeneration } from '@/types';

defineProps<{
  baseImage: CharacterVisualImage;
  finalImage: CharacterVisualImage | null;
  finalVersions: CharacterVisualGeneration[];
  isGenerating: boolean;
  isSaved: boolean;
  progress: number;
  selectedFinalGenerationId: string;
  skipRefinement: boolean;
}>();

const emit = defineEmits<{
  (event: 'selectFinalVersion', generationId: string): void;
  (event: 'update:skipRefinement', value: boolean): void;
}>();
</script>

<template>
  <section class="w-full" aria-labelledby="result-heading">
    <div class="mb-6 flex flex-col justify-between gap-3 border-b pb-5 sm:flex-row sm:items-start">
      <div>
        <h3 id="result-heading" class="text-lg font-semibold">精修正式视觉</h3>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">
          默认会以选中候选为基底生成一张 2k 定稿，尽量保持脸型、发型与画风。
        </p>
      </div>
      <label class="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
        <Switch :checked="skipRefinement" @update:checked="emit('update:skipRefinement', $event)" />
        直接保存候选
      </label>
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
      <figure class="overflow-hidden rounded-lg border bg-background">
        <div class="aspect-[3/4] bg-muted/10">
          <img :src="baseImage.url" alt="选中的角色候选基底" class="size-full object-contain" />
        </div>
        <figcaption class="border-t px-3 py-2 text-xs text-muted-foreground">候选基底</figcaption>
      </figure>

      <ImageUpscale class="mx-auto hidden size-5 text-muted-foreground lg:block" />

      <figure class="overflow-hidden rounded-lg border bg-background">
        <div
          v-if="isGenerating"
          class="flex aspect-[3/4] flex-col items-center justify-center px-6 text-center"
        >
          <LoaderCircle class="size-7 animate-spin text-primary" />
          <p class="mt-4 text-sm font-medium">正在精修定稿</p>
          <Progress :value="progress" class="mt-4 max-w-xs" />
        </div>
        <div v-else-if="finalImage" class="aspect-[3/4] bg-muted/10">
          <img :src="finalImage.url" alt="精修后的角色正式视觉" class="size-full object-contain" />
        </div>
        <div
          v-else
          class="flex aspect-[3/4] flex-col items-center justify-center px-6 text-center text-muted-foreground"
        >
          <ImageUpscale class="size-7" />
          <p class="mt-3 text-sm">
            {{ skipRefinement ? '将直接保存这张候选图' : '准备生成 2k 定稿' }}
          </p>
        </div>
        <figcaption
          class="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground"
        >
          <Check v-if="isSaved" class="size-3.5 text-emerald-600" />
          {{ isSaved ? '已设为正式视觉' : skipRefinement ? '直接保存' : '2k 精修定稿' }}
        </figcaption>
      </figure>
    </div>

    <section
      v-if="finalVersions.length"
      class="mt-7 border-t pt-5"
      aria-labelledby="version-heading"
    >
      <div class="mb-3 flex items-center gap-2">
        <History class="size-4 text-muted-foreground" />
        <div>
          <h4 id="version-heading" class="text-sm font-medium">精修版本</h4>
          <p class="mt-0.5 text-xs text-muted-foreground">选择一个已生成版本即可回退为当前定稿。</p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Button
          v-for="(version, index) in finalVersions"
          :key="version.id"
          type="button"
          variant="outline"
          class="h-auto min-h-0 w-full overflow-hidden rounded-md p-0 text-left"
          :class="
            selectedFinalGenerationId === version.id && 'border-primary ring-2 ring-primary/20'
          "
          :aria-pressed="selectedFinalGenerationId === version.id"
          :aria-label="`回退到第 ${index + 1} 个精修版本`"
          @click="emit('selectFinalVersion', version.id)"
        >
          <span class="relative block aspect-[3/4] w-full bg-muted/10">
            <img
              v-if="version.image"
              :src="version.image.url"
              :alt="`精修版本 ${index + 1}`"
              class="size-full object-cover"
            />
            <span
              v-if="selectedFinalGenerationId === version.id"
              class="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check class="size-3" />
            </span>
          </span>
        </Button>
      </div>
    </section>
  </section>
</template>
