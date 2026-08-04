<script setup lang="ts">
import { computed, ref } from 'vue';
import { Laugh, Search } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import type {
  CharacterExpressionRecord,
  CharacterLibraryCharacter,
  CharacterPortraitImage,
} from '@/types';
import ExpressionRecords from './expression-records.vue';

const props = defineProps<{
  characters: CharacterLibraryCharacter[];
  characterSelectionDisabled: boolean;
  deletingFileName: string;
  pollingState: GenerationTaskPollingState;
  records: CharacterExpressionRecord[];
  renamingTaskId: string;
  selectedCharacterId: string;
}>();

const emit = defineEmits<{
  (event: 'delete', record: CharacterExpressionRecord, image: CharacterPortraitImage): void;
  (event: 'edit', record: CharacterExpressionRecord, image: CharacterPortraitImage): void;
  (event: 'rename', record: CharacterExpressionRecord): void;
  (event: 'update:selectedCharacterId', value: string): void;
}>();

const searchQuery = ref('');
const filteredRecords = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  if (!normalizedQuery) {
    return props.records;
  }
  return props.records.filter(
    record =>
      record.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery) ||
      record.description.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
  );
});
</script>

<template>
  <section class="flex min-h-0 flex-col bg-muted/15" aria-label="表情资产库">
    <div
      class="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5"
    >
      <Select
        :model-value="selectedCharacterId"
        :disabled="characterSelectionDisabled"
        @update:model-value="emit('update:selectedCharacterId', String($event))"
      >
        <SelectTrigger class="w-full sm:w-56" aria-label="筛选角色">
          <SelectValue placeholder="选择角色" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="character in characters" :key="character.id" :value="character.id">
            {{ character.name }}
          </SelectItem>
        </SelectContent>
      </Select>

      <InputGroup class="w-full sm:w-72">
        <InputGroupAddon>
          <Search class="size-4" />
        </InputGroupAddon>
        <InputGroupInput v-model="searchQuery" placeholder="搜索表情名称或描述" />
      </InputGroup>
    </div>

    <ScrollArea class="min-h-0 flex-1">
      <ExpressionRecords
        v-if="filteredRecords.length"
        :records="filteredRecords"
        :polling-state="pollingState"
        :deleting-file-name="deletingFileName"
        :renaming-task-id="renamingTaskId"
        @delete="(deletedRecord, deletedImage) => emit('delete', deletedRecord, deletedImage)"
        @edit="(editedRecord, editedImage) => emit('edit', editedRecord, editedImage)"
        @rename="renamedRecord => emit('rename', renamedRecord)"
      />

      <div v-else class="flex min-h-full items-center justify-center px-6 py-12">
        <div class="max-w-sm text-center">
          <div
            class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
          >
            <Laugh class="size-5 text-muted-foreground" />
          </div>
          <h2 class="mt-4 text-sm font-medium">
            {{ searchQuery.trim() ? '没有找到匹配的表情' : '还没有表情' }}
          </h2>
          <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
            {{
              searchQuery.trim()
                ? '可以调整搜索内容后重试。'
                : '可以上传已有表情，或选择角色参考发起生成。'
            }}
          </p>
          <Button
            v-if="searchQuery.trim()"
            class="mt-4"
            variant="outline"
            @click="searchQuery = ''"
          >
            清除搜索
          </Button>
        </div>
      </div>
    </ScrollArea>
  </section>
</template>
