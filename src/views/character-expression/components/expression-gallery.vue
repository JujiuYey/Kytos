<script setup lang="ts">
import { computed } from 'vue';
import { Laugh, X } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import type { CharacterExpressionRecord, CharacterVisualImage } from '@/types';
import ExpressionRecords from './expression-records.vue';

const props = defineProps<{
  pollingState: GenerationTaskPollingState;
  records: CharacterExpressionRecord[];
  searchQuery: string;
}>();

const emit = defineEmits<{
  (event: 'edit', record: CharacterExpressionRecord, image: CharacterVisualImage): void;
  (event: 'update:searchQuery', value: string): void;
}>();

const filteredRecords = computed(() => {
  const normalizedQuery = props.searchQuery.trim().toLocaleLowerCase('zh-CN');
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
    <ScrollArea class="min-h-0 flex-1">
      <ExpressionRecords
        v-if="filteredRecords.length"
        :records="filteredRecords"
        :polling-state="pollingState"
        @edit="(editedRecord, editedImage) => emit('edit', editedRecord, editedImage)"
      />

      <div
        v-else
        class="flex min-h-full items-center justify-center px-6 py-12 max-w-sm text-center"
      >
        <div
          class="mx-auto flex size-12 items-center justify-center rounded-md border bg-background"
        >
          <Laugh class="size-5 text-muted-foreground" />
        </div>
        <h2 class="mt-4 text-sm font-medium">
          {{ props.searchQuery.trim() ? '没有找到匹配的表情' : '还没有表情' }}
        </h2>
        <p class="mt-1.5 text-sm leading-6 text-muted-foreground">
          {{
            props.searchQuery.trim()
              ? '可以调整搜索内容后重试。'
              : '可以上传已有表情，或选择角色参考发起生成。'
          }}
        </p>
        <Button
          v-if="props.searchQuery.trim()"
          class="mt-4"
          variant="outline"
          @click="emit('update:searchQuery', '')"
        >
          <X class="size-4" />
          清除搜索
        </Button>
      </div>
    </ScrollArea>
  </section>
</template>
