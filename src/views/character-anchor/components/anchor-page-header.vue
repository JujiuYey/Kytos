<script setup lang="ts">
import { PersonStanding, Upload } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CharacterLibraryCharacter } from '@/types';

defineProps<{
  generatorOpen: boolean;
  characters: CharacterLibraryCharacter[];
  characterSelectionDisabled: boolean;
  operationDisabled: boolean;
  selectedCharacterId: string;
}>();

const emit = defineEmits<{
  (event: 'ai-create'): void;
  (event: 'upload'): void;
  (event: 'update:selectedCharacterId', value: string): void;
}>();
</script>

<template>
  <Select
    :model-value="selectedCharacterId"
    :disabled="characterSelectionDisabled"
    @update:model-value="emit('update:selectedCharacterId', String($event))"
  >
    <SelectTrigger class="w-44 shrink-0" aria-label="选择角色">
      <SelectValue placeholder="选择角色" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem v-for="character in characters" :key="character.id" :value="character.id">
        {{ character.name }}
      </SelectItem>
    </SelectContent>
  </Select>

  <Button size="sm" variant="outline" :disabled="operationDisabled" @click="emit('upload')">
    <Upload class="size-4" />
    上传图片
  </Button>

  <Button
    size="sm"
    :variant="generatorOpen ? 'secondary' : 'default'"
    :disabled="operationDisabled"
    @click="emit('ai-create')"
  >
    <PersonStanding class="size-4" />
    生成动作
  </Button>
</template>
