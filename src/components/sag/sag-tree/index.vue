<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Input } from '@/components/ui/input';
import { Search } from '@lucide/vue';
import TreeNodeItem from './tree-node-item.vue';
import type { TreeNode } from './types';

const props = withDefaults(
  defineProps<{
    list?: TreeNode[];
    current?: string;
  }>(),
  {
    list: () => [],
    current: '',
  },
);

const emit = defineEmits<{
  (e: 'select', typeId: string): void;
}>();

const searchQuery = ref('');
const expandedNodes = ref<Set<string>>(new Set());

// 获取所有有子节点的节点ID
function getAllParentNodeIds(items: TreeNode[]): string[] {
  const parentIds = new Set<string>();

  function traverse(nodes: TreeNode[]) {
    nodes.forEach(node => {
      if (node.children && node.children.length > 0) {
        parentIds.add(node.id);
        traverse(node.children);
      }
    });
  }

  traverse(items);
  return Array.from(parentIds);
}

// 初始化展开所有节点
function initExpandedNodes() {
  const parentIds = getAllParentNodeIds(props.list);
  expandedNodes.value = new Set(parentIds);
}

// 监听列表变化，重新初始化展开节点
watch(
  () => props.list,
  () => {
    initExpandedNodes();
  },
  { immediate: true },
);

// 直接使用嵌套的树形结构，添加排序功能
function sortTree(nodes: TreeNode[]): TreeNode[] {
  return nodes
    .map(node => ({
      ...node,
      children: node.children ? sortTree(node.children) : [],
    }))
    .sort((a, b) => a.sequence - b.sequence);
}

// 递归过滤树节点
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  return nodes.reduce<TreeNode[]>((acc, node) => {
    const matches = node.name.toLowerCase().includes(query.toLowerCase());
    const filteredChildren = node.children ? filterTree(node.children, query) : [];

    if (matches || filteredChildren.length > 0) {
      acc.push({
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : node.children,
      });
    }

    return acc;
  }, []);
}

// 直接使用嵌套的树形数据，并确保排序
const treeData = computed(() => sortTree(props.list));

// 过滤后的树形数据
const filteredTree = computed(() => {
  if (!searchQuery.value) {
    return treeData.value;
  }
  return filterTree(treeData.value, searchQuery.value);
});

// 切换节点展开/折叠
function toggleNode(nodeId: string) {
  if (expandedNodes.value.has(nodeId)) {
    expandedNodes.value.delete(nodeId);
  } else {
    expandedNodes.value.add(nodeId);
  }
}

// 选择节点
function handleSelect(typeId: string) {
  emit('select', typeId);
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
      <TreeNodeItem
        v-for="node of filteredTree"
        :key="node.id"
        :node="node"
        :current="current"
        :level="0"
        :expanded-nodes="expandedNodes"
        @toggle="toggleNode"
        @select="handleSelect"
      />
    </div>
  </div>
</template>
