<script setup lang="ts">
import { computed, ref } from 'vue';
import { Input } from '@/components/ui/input';
import { Search, Box } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    list?: Recordable[];
    current?: string;
  }>(),
  {
    list: () => [],
    current: '',
  },
);

const emit = defineEmits<{
  (e: 'select', id: string): void;
}>();

const searchQuery = ref('');

const filteredList = computed(() => {
  if (!searchQuery.value) {
    return props.list;
  }
  const query = searchQuery.value.toLowerCase();
  return props.list.filter((item: Recordable) => item.name.toLowerCase().includes(query));
});

function handleSelect(id: string) {
  emit('select', id);
}
</script>

<template>
  <div class="w-64 border-r p-2 flex flex-col">
    <div class="mb-4">
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" type="search" placeholder="搜索..." class="w-full pl-8" />
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <div
        v-for="item of filteredList"
        :key="item.id"
        class="flex items-center p-2 rounded-md hover:bg-accent cursor-pointer mb-1"
        :class="{ 'bg-accent': current === item.id }"
        @click="handleSelect(item.id)"
      >
        <Box class="h-4 w-4 mr-2 text-muted-foreground" />
        <span>{{ item.name }}</span>
      </div>
    </div>
  </div>
</template>
