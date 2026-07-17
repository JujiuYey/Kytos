<script setup lang="ts">
import { watch, ref } from 'vue';
import { FileText, ListTree } from 'lucide-vue-next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CharacterDraft } from '@/types';
import CharacterDraftPanel from './character-draft-panel.vue';
import ChatSummaryPreview from './chat-summary-preview.vue';

const props = defineProps<{
  canSave: boolean;
  draft: CharacterDraft;
  isSaving: boolean;
  profileMarkdown: string;
  saved: boolean;
}>();

const emit = defineEmits<{
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
  <Tabs v-model="activeTab" class="h-full min-h-0 gap-0 bg-muted/20">
    <div class="flex h-12 shrink-0 items-center border-b px-4">
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
    </div>

    <TabsContent value="draft" class="min-h-0 data-[state=inactive]:hidden">
      <CharacterDraftPanel :draft="draft" />
    </TabsContent>
    <TabsContent value="profile" class="min-h-0 data-[state=inactive]:hidden">
      <ChatSummaryPreview
        :can-save="canSave"
        :is-saving="isSaving"
        :markdown="profileMarkdown"
        :saved="saved"
        @save="emit('save')"
      />
    </TabsContent>
  </Tabs>
</template>
