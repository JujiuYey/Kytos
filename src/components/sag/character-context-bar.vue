<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowLeft, Camera, Laugh, UserRound } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CharacterLibraryState } from '@/types';

type CharacterSection = 'character' | 'character-expression' | 'character-portrait';

const props = defineProps<{
  activeSection: CharacterSection;
}>();

const router = useRouter();
const library = ref<CharacterLibraryState | null>(null);

const activeCharacter = computed(() =>
  library.value?.characters.find(character => character.id === library.value?.activeCharacterId),
);

function openSection(section: CharacterSection): void {
  if (section !== props.activeSection) {
    void router.push({ name: section });
  }
}

onMounted(async () => {
  try {
    library.value = await window.desktop.getCharacterLibrary();
  } catch {
    library.value = null;
  }
});
</script>

<template>
  <section class="flex min-h-12 shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 sm:px-5">
    <Button size="sm" variant="ghost" class="shrink-0" @click="router.push('/characters')">
      <ArrowLeft class="size-4" />
      角色管理
    </Button>

    <div class="hidden h-5 w-px bg-border sm:block" />

    <div v-if="library" class="min-w-0 flex-1">
      <p class="truncate text-xs text-muted-foreground">当前角色</p>
      <p class="truncate text-sm font-medium">{{ activeCharacter?.name }}</p>
    </div>
    <div v-else class="min-w-0 flex-1 space-y-1">
      <Skeleton class="h-3 w-20" />
      <Skeleton class="h-4 w-28" />
    </div>

    <Tabs
      :model-value="activeSection"
      class="w-full sm:w-auto"
      @update:model-value="openSection($event as CharacterSection)"
    >
      <TabsList class="grid w-full grid-cols-3 sm:flex sm:w-auto">
        <TabsTrigger value="character">
          <UserRound class="size-3.5" />
          角色特征
        </TabsTrigger>
        <TabsTrigger value="character-portrait">
          <Camera class="size-3.5" />
          角色视觉
        </TabsTrigger>
        <TabsTrigger value="character-expression">
          <Laugh class="size-3.5" />
          表情管理
        </TabsTrigger>
      </TabsList>
    </Tabs>
  </section>
</template>
