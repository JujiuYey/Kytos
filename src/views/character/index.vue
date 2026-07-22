<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { toast } from 'vue-sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagPage } from '@/components/sag/sag-page';
import type { CharacterLibraryState, CharacterSummary } from '@/types';
import CharacterCard from './components/character-card.vue';
import CharacterCardSkeleton from './components/character-card-skeleton.vue';
import CharacterPageHeader from './components/character-page-header.vue';

const router = useRouter();
const library = ref<CharacterLibraryState | null>(null);
const loading = ref(true);
const busy = ref(false);
const errorMessage = ref('');
const deleteTarget = ref<CharacterSummary | null>(null);

const characters = computed(() => library.value?.characters ?? []);

async function loadLibrary(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  try {
    library.value = await window.desktop.character.library.getCharacterLibrary();
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loading.value = false;
  }
}

function createCharacter(): void {
  void router.push({ name: 'character-create' });
}

async function editCharacter(character: CharacterSummary): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    library.value = await window.desktop.character.library.selectCharacter({
      characterId: character.id,
    });
    await router.push({
      name: 'character-create',
      query: { characterId: character.id, mode: 'edit' },
    });
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

function requestDelete(character: CharacterSummary): void {
  deleteTarget.value = character;
}

async function confirmDelete(): Promise<void> {
  const target = deleteTarget.value;
  if (!target || busy.value) {
    return;
  }
  busy.value = true;
  try {
    library.value = await window.desktop.character.library.deleteCharacter({
      characterId: target.id,
    });
    deleteTarget.value = null;
    toast.success('角色已移除');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  void loadLibrary();
});
</script>

<template>
  <SagPage>
    <template #header>
      <CharacterPageHeader :count="characters.length" :busy="busy" @create="createCharacter" />
    </template>

    <SagErrorRetryAlert
      v-if="errorMessage"
      class="mx-4 mt-4 shrink-0 sm:mx-5"
      title="角色资料暂时无法读取"
      :error-message="errorMessage"
      retry-label="重试"
      @retry="loadLibrary"
    />

    <ScrollArea class="min-h-0 flex-1 bg-muted/10">
      <div
        v-if="loading"
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <CharacterCardSkeleton v-for="index in 6" :key="index" :index="index" />
      </div>

      <div
        v-else
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <CharacterCard
          v-for="character in characters"
          :key="character.id"
          :busy="busy"
          :character="character"
          :is-active="library?.activeCharacterId === character.id"
          @edit="editCharacter"
          @request-delete="requestDelete"
        />
      </div>
    </ScrollArea>

    <SagConfirmDialog
      :open="Boolean(deleteTarget)"
      title="移除这个角色？"
      description="角色将从管理列表移除。为避免破坏旧作品，已经生成的图片文件会保留在工作区。"
      confirm-text="确认移除"
      :loading="busy"
      @update:open="value => !value && (deleteTarget = null)"
      @confirm="confirmDelete"
    />
  </SagPage>
</template>
