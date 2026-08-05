<script setup lang="ts">
import { Search, Upload, WandSparkles } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CharacterLibraryCharacter } from '@/types';

defineProps<{
  characters: CharacterLibraryCharacter[];
  characterSelectionDisabled: boolean;
  generatorOpen: boolean;
  searchQuery: string;
  selectedCharacterId: string;
}>();

const emit = defineEmits<{
  (event: 'ai-create'): void;
  (event: 'upload'): void;
  (event: 'update:searchQuery', value: string): void;
  (event: 'update:selectedCharacterId', value: string): void;
}>();
</script>

<template>
  <div class="flex w-full flex-wrap items-center justify-end gap-2 lg:w-auto">
    <Select
      :model-value="selectedCharacterId"
      :disabled="characterSelectionDisabled"
      @update:model-value="emit('update:selectedCharacterId', String($event))"
    >
      <SelectTrigger class="w-full sm:w-48" aria-label="筛选角色">
        <SelectValue placeholder="选择角色" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="character in characters" :key="character.id" :value="character.id">
          {{ character.name }}
        </SelectItem>
      </SelectContent>
    </Select>

    <InputGroup class="w-full sm:w-64">
      <InputGroupAddon>
        <Search class="size-4" />
      </InputGroupAddon>
      <InputGroupInput
        :model-value="searchQuery"
        placeholder="搜索表情名称或描述"
        @update:model-value="emit('update:searchQuery', String($event))"
      />
    </InputGroup>

    <Button size="sm" variant="outline" @click="emit('upload')">
      <Upload class="size-4" />
      上传表情
    </Button>
    <Button size="sm" :variant="generatorOpen ? 'secondary' : 'default'" @click="emit('ai-create')">
      <WandSparkles class="size-4" />
      创建
    </Button>
  </div>
</template>
