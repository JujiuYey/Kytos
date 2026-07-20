<script setup lang="ts">
import { Images } from '@lucide/vue';
import { Loader } from '@/components/ai-elements/loader';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CharacterVisualCard, CharacterVisualCardDraw } from '@/types';
import CharacterVisualCardDrawView from './character-visual-card-draw.vue';

defineProps<{
  busy: boolean;
  draws: CharacterVisualCardDraw[];
  pollingStates: GenerationPollingStateMap;
  savingCardIds: string[];
}>();

const emit = defineEmits<{
  (event: 'adjust', card: CharacterVisualCard): void;
  (event: 'save', payload: { card: CharacterVisualCard; draw: CharacterVisualCardDraw }): void;
}>();
</script>

<template>
  <div v-if="busy" class="flex shrink-0 items-center gap-2 border-b px-4 py-3 text-sm">
    <Loader />
    正在把角色草稿转成一张视觉卡
  </div>

  <ScrollArea class="min-h-0 flex-1">
    <div
      v-if="draws.length === 0"
      class="flex min-h-80 flex-col items-center justify-center gap-3 px-6 text-center"
    >
      <div class="flex size-10 items-center justify-center rounded-md border bg-muted/30">
        <Images class="size-5 text-muted-foreground" />
      </div>
      <div>
        <p class="text-sm font-medium">还没有抽卡结果</p>
        <p class="mt-1 text-xs leading-5 text-muted-foreground">
          完善人物种子、形象锚点和视觉表现后，可以抽取一张视觉卡。
        </p>
      </div>
    </div>

    <div v-else class="divide-y">
      <CharacterVisualCardDrawView
        v-for="draw in draws"
        :key="draw.id"
        :busy="busy"
        :draw="draw"
        :polling-states="pollingStates"
        :saving-card-ids="savingCardIds"
        @adjust="emit('adjust', $event)"
        @save="emit('save', $event)"
      />
    </div>
  </ScrollArea>
</template>
