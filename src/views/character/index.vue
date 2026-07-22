<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserRoundPlus } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagPage } from '@/components/sag/sag-page';
import type { CharacterLibraryCharacter, CharacterLibraryState, CharacterSummary } from '@/types';
import CharacterCard from './components/character-card.vue';
import CharacterCardSkeleton from './components/character-card-skeleton.vue';
import CharacterPageHeader from './components/character-page-header.vue';
import CharacterSummaryDialog from './components/character-summary-dialog.vue';

const router = useRouter();
const library = ref<CharacterLibraryState | null>(null);
const loading = ref(true);
const busy = ref(false);
const errorMessage = ref('');
const deleteTarget = ref<CharacterSummary | null>(null);
const summaryDialogOpen = ref(false);
const summaryDialogMode = ref<'create' | 'rename'>('create');
const summaryTarget = ref<CharacterSummary | null>(null);

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
  summaryDialogMode.value = 'create';
  summaryTarget.value = null;
  summaryDialogOpen.value = true;
}

function renameCharacter(character: CharacterSummary): void {
  summaryDialogMode.value = 'rename';
  summaryTarget.value = character;
  summaryDialogOpen.value = true;
}

async function submitCharacterSummary(name: string): Promise<void> {
  if (busy.value) return;
  busy.value = true;
  try {
    if (summaryDialogMode.value === 'create') {
      library.value = await window.desktop.character.library.createCharacter({ name });
      const characterId = library.value.activeCharacterId;
      summaryDialogOpen.value = false;
      toast.success('角色概要已创建');
      await router.push({ name: 'character-create', query: { characterId } });
      return;
    }
    const target = summaryTarget.value;
    if (!target) return;
    library.value = await window.desktop.character.library.updateCharacter({
      characterId: target.id,
      name,
    });
    summaryDialogOpen.value = false;
    toast.success('角色名称已更新');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

async function openCharacterVisual(character: CharacterLibraryCharacter): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    library.value = await window.desktop.character.library.selectCharacter({
      characterId: character.id,
    });
    await router.push(
      character.visualAsset
        ? { name: 'character-portrait' }
        : { name: 'character-create', query: { characterId: character.id } },
    );
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
        v-else-if="characters.length"
        class="mx-auto w-full max-w-7xl columns-1 gap-5 px-4 py-5 sm:columns-2 sm:px-5 xl:columns-3 2xl:columns-4"
      >
        <CharacterCard
          v-for="character in characters"
          :key="character.id"
          :busy="busy"
          :character="character"
          :is-active="library?.activeCharacterId === character.id"
          @open-visual="openCharacterVisual"
          @rename="renameCharacter"
          @request-delete="requestDelete"
        />
      </div>

      <div v-else class="flex min-h-80 flex-col items-center justify-center px-6 text-center">
        <UserRoundPlus class="size-10 text-muted-foreground" />
        <h2 class="mt-4 text-base font-semibold">还没有角色</h2>
        <p class="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          先创建角色概要，再继续为它建立第一个正式形象。
        </p>
        <Button class="mt-5" @click="createCharacter">
          <UserRoundPlus class="size-4" />
          新建角色
        </Button>
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

    <CharacterSummaryDialog
      :current-name="summaryTarget?.name || ''"
      :loading="busy"
      :mode="summaryDialogMode"
      :open="summaryDialogOpen"
      @submit="submitCharacterSummary"
      @update:open="summaryDialogOpen = $event"
    />
  </SagPage>
</template>
