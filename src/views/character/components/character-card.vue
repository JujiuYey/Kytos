<script setup lang="ts">
import { Camera, ImagePlus, Pencil, Trash2, UserRound } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CharacterVisualSize, CharacterLibraryCharacter } from '@/types';

const anchorAspectClasses: Record<CharacterVisualSize, string> = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '2:3': 'aspect-[2/3]',
  '3:4': 'aspect-[3/4]',
  '4:5': 'aspect-[4/5]',
};

function getAnchorAspectClass(size: CharacterVisualSize): string {
  return anchorAspectClasses[size];
}

defineProps<{
  character: CharacterLibraryCharacter;
  busy: boolean;
}>();

defineEmits<{
  (event: 'open-anchor', character: CharacterLibraryCharacter): void;
  (event: 'rename', character: CharacterLibraryCharacter): void;
  (event: 'request-delete', character: CharacterLibraryCharacter): void;
}>();
</script>

<template>
  <article
    class="mb-5 inline-block w-full break-inside-avoid overflow-hidden rounded-md border bg-background align-top"
  >
    <Button
      variant="ghost"
      class="block h-auto w-full rounded-none p-0 focus-visible:ring-inset"
      :disabled="busy"
      :aria-label="
        character.visualAsset
          ? `管理角色 ${character.name} 的锚点`
          : `为角色 ${character.name} 创建第一个形象`
      "
      @click="$emit('open-anchor', character)"
    >
      <AiImage
        v-if="character.visualAsset"
        :alt="`${character.name}的${character.visualAsset.name}`"
        :src="character.visualAsset.url"
        :class="[
          getAnchorAspectClass(character.visualAsset.size),
          'w-full rounded-none bg-muted/30 object-cover transition-opacity hover:opacity-95',
        ]"
      />
      <div
        v-else
        class="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-muted-foreground"
      >
        <UserRound class="size-10" />
        <span class="text-xs">尚无正式角色锚点</span>
      </div>
    </Button>

    <div class="space-y-3 border-t px-3 py-3">
      <div class="flex min-w-0 items-start justify-between gap-2">
        <div class="min-w-0">
          <h2 class="truncate text-sm font-medium">{{ character.name }}</h2>
          <p class="mt-1 truncate text-xs text-muted-foreground">
            {{
              character.visualAsset
                ? `正式资产 · ${character.visualAsset.name}`
                : '等待添加正式角色锚点'
            }}
          </p>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="outline"
          :disabled="busy"
          @click="$emit('open-anchor', character)"
        >
          <Camera v-if="character.visualAsset" class="size-4" />
          <ImagePlus v-else class="size-4" />
          {{ character.visualAsset ? '管理锚点' : '创建第一个形象' }}
        </Button>
        <div class="flex shrink-0 items-center gap-1">
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  :disabled="busy"
                  :aria-label="`修改${character.name}名称`"
                  @click="$emit('rename', character)"
                >
                  <Pencil class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>修改名称</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider :delay-duration="300">
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  class="text-muted-foreground hover:text-destructive"
                  :disabled="busy"
                  :aria-label="`移除${character.name}`"
                  @click="$emit('request-delete', character)"
                >
                  <Trash2 class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>移除角色</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  </article>
</template>
