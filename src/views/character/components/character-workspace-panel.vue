<script setup lang="ts">
import { ref, watch } from 'vue';
import { Images, ListTree, Sparkles, X } from '@lucide/vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { GenerationPollingStateMap } from '@/components/sag/generation-polling-status';
import type { CharacterDraft, CharacterVisualCard, CharacterVisualCardDraw } from '@/types';
import CharacterDraftPanel from './character-draft-panel.vue';
import CharacterVisualCardResults from './character-visual-card-results.vue';

const props = defineProps<{
  canDrawVisual: boolean;
  drawBusy: boolean;
  drawDisabledReason: string;
  draft: CharacterDraft;
  pollingStates: GenerationPollingStateMap;
  savingCardIds: string[];
  visualDraws: CharacterVisualCardDraw[];
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'adjust-visual', card: CharacterVisualCard): void;
  (event: 'draw-visual'): void;
  (
    event: 'save-visual',
    payload: { card: CharacterVisualCard; draw: CharacterVisualCardDraw },
  ): void;
}>();

const activeTab = ref('draft');

watch(
  () => props.drawBusy,
  drawBusy => {
    if (drawBusy) {
      activeTab.value = 'visual';
    }
  },
);

watch(
  () => props.visualDraws[0]?.id,
  (drawId, previousDrawId) => {
    if (drawId && drawId !== previousDrawId) {
      activeTab.value = 'visual';
    }
  },
);
</script>

<template>
  <Tabs v-model="activeTab" class="h-full min-h-0 gap-0">
    <div class="flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4">
      <TabsList class="h-8">
        <TabsTrigger value="draft">
          <ListTree class="size-3.5" />
          结构化草稿
        </TabsTrigger>
        <TabsTrigger value="visual">
          <Images class="size-3.5" />
          抽卡结果
        </TabsTrigger>
      </TabsList>
      <Button variant="ghost" size="icon" aria-label="关闭角色档案面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <TabsContent value="draft" class="flex min-h-0 flex-col data-[state=inactive]:hidden">
      <CharacterDraftPanel :draft="draft" />
    </TabsContent>
    <TabsContent value="visual" class="flex min-h-0 flex-col data-[state=inactive]:hidden">
      <CharacterVisualCardResults
        :busy="drawBusy"
        :draws="visualDraws"
        :polling-states="pollingStates"
        :saving-card-ids="savingCardIds"
        @adjust="emit('adjust-visual', $event)"
        @save="emit('save-visual', $event)"
      />
    </TabsContent>

    <div class="shrink-0 border-t p-4">
      <Button
        class="w-full"
        :disabled="!canDrawVisual || drawBusy"
        :title="drawDisabledReason"
        @click="emit('draw-visual')"
      >
        <Sparkles class="size-4" />
        {{ drawBusy ? '正在抽取视觉卡' : '抽取视觉卡' }}
      </Button>
    </div>
  </Tabs>
</template>
