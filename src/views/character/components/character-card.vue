<script setup lang="ts">
import { Check, MoreHorizontal, Pencil, Trash2, UserRound } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SagStatusBadge } from '@/components/sag/status-badge';
import type { CharacterImageSize, CharacterLibraryCharacter } from '@/types';

const visualAssetAspectClasses: Record<CharacterImageSize, string> = {
  '1:1': 'aspect-square',
  '16:9': 'aspect-video',
  '2:3': 'aspect-[2/3]',
  '3:4': 'aspect-[3/4]',
  '4:5': 'aspect-[4/5]',
};

function getVisualAssetAspectClass(size: CharacterImageSize): string {
  return visualAssetAspectClasses[size];
}

defineProps<{
  character: CharacterLibraryCharacter;
  isActive: boolean;
  busy: boolean;
}>();

defineEmits<{
  (event: 'edit', character: CharacterLibraryCharacter): void;
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
      :aria-label="`编辑角色 ${character.name}`"
      @click="$emit('edit', character)"
    >
      <AiImage
        v-if="character.visualAsset"
        :alt="`${character.name}的${character.visualAsset.name}`"
        :src="character.visualAsset.url"
        :class="[
          getVisualAssetAspectClass(character.visualAsset.size),
          'w-full rounded-none bg-muted/30 object-cover transition-opacity hover:opacity-95',
        ]"
      />
      <div
        v-else
        class="flex aspect-[3/4] w-full flex-col items-center justify-center gap-3 bg-muted/30 px-4 text-muted-foreground"
      >
        <UserRound class="size-10" />
        <span class="text-xs">尚无正式角色视觉</span>
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
                : '等待添加正式角色视觉'
            }}
          </p>
        </div>
        <SagStatusBadge v-if="isActive" tone="success" class="shrink-0">
          <Check class="size-3" />
          当前角色
        </SagStatusBadge>
      </div>

      <div class="flex items-center justify-between gap-2">
        <Button size="sm" variant="outline" :disabled="busy" @click="$emit('edit', character)">
          编辑角色
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button size="icon-sm" variant="ghost" :aria-label="`管理角色 ${character.name}`">
              <MoreHorizontal class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="$emit('edit', character)">
              <Pencil class="size-4" />
              编辑角色
            </DropdownMenuItem>
            <DropdownMenuItem
              class="text-destructive focus:text-destructive"
              @select="$emit('request-delete', character)"
            >
              <Trash2 class="size-4" />
              移除角色
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </article>
</template>
