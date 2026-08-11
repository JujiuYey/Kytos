<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { UserRoundPlus, UsersRound } from '@lucide/vue';
import { toast } from 'vue-sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SagConfirmDialog } from '@/components/sag/sag-confirm-dialog';
import { SagErrorRetryAlert } from '@/components/sag/error-retry-alert';
import { SagPage } from '@/components/sag/sag-page';
import { useCharacterLibraryStore } from '@/stores/character-library';
import type { CharacterLibraryCharacter, CharacterSummary } from '@/types';
import CharacterCard from './components/character-card.vue';
import CharacterCardSkeleton from './components/character-card-skeleton.vue';
import CharacterRenameDialog from './components/character-rename-dialog.vue';

const router = useRouter();
const characterLibraryStore = useCharacterLibraryStore();

const characters = computed(() => characterLibraryStore.characters);
const busy = ref(false);

const loading = computed(
  () => characterLibraryStore.isLoading || !characterLibraryStore.isInitialized,
);
const errorMessage = computed(() => characterLibraryStore.errorMessage);

async function loadLibrary(): Promise<void> {
  await characterLibraryStore.refresh().catch(() => undefined);
}

onMounted(() => {
  void loadLibrary();
});

function createCharacter(): void {
  void router.push({ name: 'character-create', query: { new: '1' } });
}

const renameDialogOpen = ref(false);
const renameTarget = ref<CharacterSummary | null>(null);

function renameCharacter(character: CharacterSummary): void {
  renameTarget.value = character;
  renameDialogOpen.value = true;
}

async function submitCharacterRename(name: string): Promise<void> {
  if (busy.value) return;
  const target = renameTarget.value;
  if (!target) return;
  busy.value = true;
  try {
    await characterLibraryStore.updateCharacter({
      characterId: target.id,
      name,
    });
    renameDialogOpen.value = false;
    toast.success('角色名称已更新');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

async function openCharacterAnchor(character: CharacterLibraryCharacter): Promise<void> {
  if (busy.value) {
    return;
  }
  busy.value = true;
  try {
    await router.push(
      character.visualAsset
        ? { name: 'character-anchor', query: { characterId: character.id } }
        : { name: 'character-create', query: { characterId: character.id } },
    );
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : String(error));
  } finally {
    busy.value = false;
  }
}

const deleteTarget = ref<CharacterSummary | null>(null);

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
    await characterLibraryStore.deleteCharacter({
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
</script>

<template>
  <SagPage title="角色管理" description="管理多个角色及其完整形象资料" :icon="UsersRound">
    <template #header-leading>
      <Badge variant="secondary" class="shrink-0 tabular-nums">
        {{ characters.length }}
      </Badge>
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
          @open-anchor="openCharacterAnchor"
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

    <CharacterRenameDialog
      :current-name="renameTarget?.name || ''"
      :loading="busy"
      :open="renameDialogOpen"
      @submit="submitCharacterRename"
      @update:open="renameDialogOpen = $event"
    />
  </SagPage>
</template>
