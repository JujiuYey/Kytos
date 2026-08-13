<script setup lang="ts">
import { ref, watch } from 'vue';
import { UserRound, UsersRound } from '@lucide/vue';
import { Image as AiImage } from '@/components/ai-elements/image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { CharacterLibraryCharacter } from '@/types';

const props = defineProps<{
  busy: boolean;
  characters: CharacterLibraryCharacter[];
  mode: 'create' | 'update';
  open: boolean;
  selectedIds: string[];
}>();

const emit = defineEmits<{
  (event: 'confirm', characterIds: string[]): void;
  (event: 'manage-characters'): void;
  (event: 'update:open', value: boolean): void;
}>();

const draftIds = ref<string[]>([]);

function toggleCharacter(characterId: string): void {
  draftIds.value = draftIds.value.includes(characterId)
    ? draftIds.value.filter(id => id !== characterId)
    : [...draftIds.value, characterId];
}

function confirmSelection(): void {
  if (!draftIds.value.length) return;
  emit('confirm', draftIds.value);
}

watch(
  () => props.open,
  open => {
    if (!open) return;
    const availableIds = new Set(props.characters.map(character => character.id));
    const selectedIds = props.selectedIds.filter(id => availableIds.has(id));
    const onlyCharacter = props.characters.length === 1 ? props.characters[0] : undefined;
    draftIds.value = selectedIds.length ? selectedIds : onlyCharacter ? [onlyCharacter.id] : [];
  },
);
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="flex max-h-[72vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
      <DialogHeader class="shrink-0 border-b px-5 py-4">
        <DialogTitle>{{ mode === 'create' ? '选择故事角色' : '管理参演角色' }}</DialogTitle>
        <DialogDescription>
          故事会使用所选角色的正式锚点和表情素材，分镜生成时继续保持角色一致性。
        </DialogDescription>
      </DialogHeader>

      <ScrollArea class="min-h-0 flex-1">
        <div v-if="characters.length" class="space-y-2 p-5">
          <Button
            v-for="character in characters"
            :key="character.id"
            variant="outline"
            :aria-pressed="draftIds.includes(character.id)"
            :class="[
              'h-auto w-full justify-start gap-3 p-3 text-left',
              draftIds.includes(character.id) && 'border-primary bg-primary/5',
            ]"
            :disabled="busy"
            @click="toggleCharacter(character.id)"
          >
            <AiImage
              v-if="character.visualAsset"
              :src="character.visualAsset.url"
              :alt="character.name"
              class="size-12 shrink-0 rounded-sm border bg-muted/20 object-contain"
            />
            <span
              v-else
              class="flex size-12 shrink-0 items-center justify-center rounded-sm border bg-muted/30"
            >
              <UserRound class="size-5 text-muted-foreground" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium">{{ character.name }}</span>
              <span class="mt-1 block text-xs text-muted-foreground">
                {{ character.visualAsset ? '正式角色锚点已就绪' : '还没有正式角色锚点' }}
              </span>
            </span>
            <Checkbox :model-value="draftIds.includes(character.id)" class="pointer-events-none" />
          </Button>
        </div>

        <div v-else class="flex min-h-56 items-center justify-center px-6 py-10 text-center">
          <div class="max-w-sm">
            <UsersRound class="mx-auto size-6 text-muted-foreground" />
            <h3 class="mt-3 text-sm font-medium">还没有可用角色</h3>
            <p class="mt-1 text-sm leading-6 text-muted-foreground">
              先在角色管理中创建角色并上传标准参考图，再回来开始故事。
            </p>
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="shrink-0 border-t px-5 py-4">
        <Button variant="outline" :disabled="busy" @click="emit('manage-characters')">
          角色管理
        </Button>
        <Button
          v-if="characters.length"
          :disabled="busy || !draftIds.length"
          @click="confirmSelection"
        >
          {{ mode === 'create' ? '使用所选角色创建' : '保存参演角色' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
