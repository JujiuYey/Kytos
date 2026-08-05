<script setup lang="ts">
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import type {
  CharacterExpressionRecord,
  CharacterExpressionTask,
  CharacterVisualImage,
} from '@/types';
import ExpressionImageCard from './expression-image-card.vue';
import ExpressionTaskCard from './expression-task-card.vue';

defineProps<{
  records: CharacterExpressionRecord[];
  pollingState: GenerationTaskPollingState;
  tasks: CharacterExpressionTask[];
}>();

const emit = defineEmits<{
  (event: 'edit', record: CharacterExpressionRecord, image: CharacterVisualImage): void;
}>();

function getRecordStatusLabel(record: CharacterExpressionRecord): string {
  return record.source === 'uploaded' ? '已上传' : '已完成';
}
</script>

<template>
  <div
    class="mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-5 gap-y-8 px-5 py-6 sm:grid-cols-2 xl:grid-cols-3 lg:px-8"
  >
    <template v-for="task in tasks" :key="task.id">
      <article class="min-w-0 overflow-hidden rounded-md border bg-background">
        <ExpressionTaskCard :polling-state="pollingState" :task="task" />
      </article>
    </template>

    <template v-for="record in records" :key="record.id">
      <ExpressionImageCard
        v-for="(image, imageIndex) in record.images"
        :key="image.fileName"
        :record="record"
        :image="image"
        :image-index="imageIndex"
        :status-label="getRecordStatusLabel(record)"
        @edit="(editedRecord, editedImage) => emit('edit', editedRecord, editedImage)"
      />
    </template>
  </div>
</template>
