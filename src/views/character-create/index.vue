<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Upload } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SagPage } from '@/components/sag/sag-page';
import { characterAnchorUploadApi } from '@/lib/character-anchor-api';
import { useCharacterLibraryStore } from '@/stores/character-library';
import type { SaveFileRequest } from '@/types';
import CharacterSummaryStart from './components/character-summary-start.vue';

const route = useRoute();
const router = useRouter();
const characterLibraryStore = useCharacterLibraryStore();

const isInitializing = ref(true);
const isSavingSummary = ref(false);
const summaryInitialName = ref('');
const summaryTargetId = ref('');

const characterId = computed(() =>
  typeof route.query.characterId === 'string' ? route.query.characterId : '',
);
const isNewCharacterRequested = computed(() => route.query.new === '1');

async function saveCharacterSummary(name: string, visualAsset: SaveFileRequest): Promise<void> {
  if (isSavingSummary.value) return;
  isSavingSummary.value = true;
  try {
    const character = summaryTargetId.value
      ? await characterLibraryStore.updateCharacter({
          characterId: summaryTargetId.value,
          name,
        })
      : await characterLibraryStore.createCharacter({ name });

    await characterAnchorUploadApi.save({
      characterId: character.id,
      fileData: visualAsset.fileData,
      fileName: visualAsset.fileName,
      mimeType: visualAsset.mimeType,
    });
    toast.success('角色和已有锚点已保存');
    await router.push({ name: 'character' });
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    isSavingSummary.value = false;
  }
}

async function initialize(): Promise<void> {
  try {
    await characterLibraryStore.initialize();
    if (!characterId.value) {
      const existingCharacter = isNewCharacterRequested.value
        ? undefined
        : characterLibraryStore.characters.find(character => !character.visualAsset);
      if (existingCharacter) {
        summaryTargetId.value = existingCharacter.id;
        summaryInitialName.value = existingCharacter.name;
      }
      return;
    }

    const character = characterLibraryStore.characters.find(item => item.id === characterId.value);
    if (!character) throw new Error('未找到这个角色');
    if (character.visualAsset) {
      toast.info('这个角色已经有正式锚点，请在角色锚点中继续管理');
      await router.replace({ name: 'character-anchor', query: { characterId: character.id } });
      return;
    }

    summaryTargetId.value = character.id;
    summaryInitialName.value = character.name;
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
    await router.replace({ name: 'character' });
  } finally {
    isInitializing.value = false;
  }
}

onMounted(() => {
  void initialize();
});
</script>

<template>
  <SagPage
    title="创建角色"
    description="填写角色名称，上传一张已有角色锚点后完成创建。"
    :icon="Upload"
  >
    <div v-if="isInitializing" class="flex min-h-0 flex-1 items-center justify-center bg-muted/20">
      <div class="text-sm text-muted-foreground">正在读取角色信息</div>
    </div>

    <ScrollArea v-else class="min-h-0 flex-1 bg-muted/20">
      <main class="mx-auto flex min-h-full w-full max-w-5xl px-5 py-9 sm:px-8 lg:px-10 lg:py-14">
        <CharacterSummaryStart
          :existing="Boolean(summaryTargetId)"
          :initial-name="summaryInitialName"
          :loading="isSavingSummary"
          @submit="saveCharacterSummary"
        />
      </main>
    </ScrollArea>
  </SagPage>
</template>
