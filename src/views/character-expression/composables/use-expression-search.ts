import { computed, ref, type Ref } from 'vue';
import type { CharacterExpressionRecord, CharacterExpressionTask } from '@/types';

interface UseExpressionSearchOptions {
  records: Readonly<Ref<CharacterExpressionRecord[]>>;
  tasks: Readonly<Ref<CharacterExpressionTask[]>>;
}

export function useExpressionSearch(options: UseExpressionSearchOptions) {
  const searchQuery = ref('');

  const filteredRecords = computed<CharacterExpressionRecord[]>(() => {
    const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
    if (!normalizedQuery) {
      return [...options.records.value];
    }
    return options.records.value.filter(
      record =>
        record.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery) ||
        record.description.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
    );
  });

  const filteredTasks = computed<CharacterExpressionTask[]>(() => {
    const normalizedQuery = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
    if (!normalizedQuery) {
      return [...options.tasks.value];
    }
    return options.tasks.value.filter(
      task =>
        task.name.toLocaleLowerCase('zh-CN').includes(normalizedQuery) ||
        task.description.toLocaleLowerCase('zh-CN').includes(normalizedQuery),
    );
  });

  function cleanQuery() {
    searchQuery.value = '';
  }

  return { searchQuery, filteredRecords, filteredTasks, cleanQuery };
}
