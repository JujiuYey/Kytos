import { computed, ref, type Ref } from 'vue';
import type { CharacterExpressionRecord } from '@/types';

interface UseExpressionSearchOptions {
  records: Readonly<Ref<CharacterExpressionRecord[]>>;
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

  function clearSearch(): void {
    searchQuery.value = '';
  }

  return { clearSearch, filteredRecords, searchQuery };
}
