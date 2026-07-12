<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight, FolderOpen } from 'lucide-vue-next';
import { useGachaStore } from '@/stores/gacha';

const store = useGachaStore();
const categories = computed(() => store.project?.categories ?? []);
</script>

<template>
  <div class="h-full overflow-y-auto border-r">
    <div
      v-for="category of categories"
      :key="category.name"
      class="border-b"
    >
      <div class="px-3 py-2 flex items-center gap-2 bg-muted/30 text-sm font-medium">
        <FolderOpen class="size-4 text-muted-foreground" />
        <span>{{ category.name }}</span>
        <span class="ml-auto text-xs text-muted-foreground">
          {{ category.prompts.length }}
        </span>
      </div>
      <ul>
        <li
          v-for="prompt of category.prompts"
          :key="prompt.md_path"
          class="px-3 py-1.5 flex items-center gap-2 cursor-pointer text-sm hover:bg-accent"
          :class="{
            'bg-accent text-accent-foreground': store.selectedPrompt?.prompt.name === prompt.name
              && store.selectedPrompt?.categoryName === category.name,
          }"
          @click="store.selectPrompt(category.name, prompt)"
        >
          <ChevronRight class="size-3 text-muted-foreground" />
          <span class="truncate flex-1">{{ prompt.name }}</span>
          <span
            v-if="prompt.images.length > 0"
            class="text-xs text-muted-foreground tabular-nums"
          >
            ×{{ prompt.images.length }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
