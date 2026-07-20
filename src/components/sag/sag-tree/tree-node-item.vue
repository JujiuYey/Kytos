<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from '@lucide/vue';
import type { TreeNode } from './types';

const props = withDefaults(
  defineProps<{
    node: TreeNode;
    current?: string;
    level?: number;
    expandedNodes: Set<string>;
  }>(),
  {
    current: '',
    level: 0,
  },
);

const emit = defineEmits<{
  (e: 'toggle', nodeId: string): void;
  (e: 'select', nodeId: string): void;
}>();

const hasChildren = computed(() => props.node.children && props.node.children.length > 0);
const isExpanded = computed(() => props.expandedNodes.has(props.node.id));

function handleToggle() {
  if (hasChildren.value) {
    emit('toggle', props.node.id);
  }
}

function handleSelect() {
  emit('select', props.node.id);
}
</script>

<template>
  <div>
    <div
      class="flex items-center p-2 rounded-md hover:bg-accent cursor-pointer mb-1 group"
      :class="{ 'bg-accent': current === node.id }"
      :style="{ paddingLeft: `${level * 16 + 8}px` }"
      @click="handleSelect"
    >
      <button
        v-if="hasChildren"
        class="mr-1 p-0.5 hover:bg-accent-foreground/10 rounded"
        @click.stop="handleToggle"
      >
        <ChevronRight v-if="!isExpanded" class="h-4 w-4 text-muted-foreground" />
        <ChevronDown v-else class="h-4 w-4 text-muted-foreground" />
      </button>
      <div v-else class="w-5 mr-1" />

      <component
        :is="hasChildren ? (isExpanded ? FolderOpen : Folder) : Folder"
        class="h-4 w-4 mr-2 text-muted-foreground"
      />
      <span class="text-sm">{{ node.name }}</span>
    </div>

    <template v-if="hasChildren && isExpanded">
      <TreeNodeItem
        v-for="child of node.children"
        :key="child.id"
        :node="child"
        :current="current"
        :level="level + 1"
        :expanded-nodes="expandedNodes"
        @toggle="$emit('toggle', $event)"
        @select="$emit('select', $event)"
      />
    </template>
  </div>
</template>
