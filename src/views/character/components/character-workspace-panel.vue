<script setup lang="ts">
import { watch, ref } from 'vue';
import { FileText, ListTree, Sparkles, X } from '@lucide/vue';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import type { CharacterDraft } from '@/types';
import CharacterDraftPanel from './character-draft-panel.vue';
import ChatSummaryPreview from './chat-summary-preview.vue';

const props = defineProps<{
  canSave: boolean;
  canDrawVisual: boolean;
  drawBusy: boolean;
  drawDisabledReason: string;
  draft: CharacterDraft;
  isSaving: boolean;
  profileMarkdown: string;
  saved: boolean;
}>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'draw-visual'): void;
  (event: 'save'): void;
}>();

const activeTab = ref('draft');

watch(
  () => props.canSave,
  canSave => {
    if (canSave) {
      activeTab.value = 'profile';
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
        <TabsTrigger value="profile">
          <FileText class="size-3.5" />
          完成稿
        </TabsTrigger>
      </TabsList>
      <Button variant="ghost" size="icon" aria-label="关闭角色档案面板" @click="emit('close')">
        <X class="size-4" />
      </Button>
    </div>

    <TabsContent value="draft" class="flex min-h-0 flex-col data-[state=inactive]:hidden">
      <CharacterDraftPanel :draft="draft" />
    </TabsContent>
    <TabsContent value="profile" class="flex min-h-0 flex-col data-[state=inactive]:hidden">
      <ChatSummaryPreview
        :can-save="canSave"
        :is-saving="isSaving"
        :markdown="profileMarkdown"
        :saved="saved"
        @save="emit('save')"
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
