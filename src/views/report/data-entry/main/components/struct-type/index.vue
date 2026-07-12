<script setup lang="ts">
import {
  Construction,
  Landmark,
  Layers,
} from 'lucide-vue-next';
// import { useProjectContext } from '@/views/basic/bridge/composables/useProjectContext';

const props = defineProps<{
  tab: string;
}>();

const emit = defineEmits<{
  (e: 'update:tab', tabKey: string): void;
}>();

// 使用项目上下文
// const projectContext = useProjectContext();
// const { bridgeId } = toRefs(projectContext);

const activeTab = computed({
  get: () => props.tab,
  set: (value: string) => emit('update:tab', value),
});

/**
 * 结构类型
 */
interface StructSection {
  title: string;
  key: string;
  icon: any;
}

const settingTabs: StructSection[] = [
  { title: '上部结构', key: 'upper', icon: Construction },
  { title: '下部结构', key: 'lower', icon: Landmark },
  { title: '桥面系', key: 'deck', icon: Layers },
];

// 切换标签
function switchTab(tabKey: string) {
  activeTab.value = tabKey;
  emit('update:tab', tabKey);
}

// 获取标签按钮样式
function getTabButtonClass(tabKey: string) {
  return {
    'bg-primary text-primary-foreground shadow-sm': activeTab.value === tabKey,
    'hover:bg-accent hover:text-accent-foreground': activeTab.value !== tabKey,
    'transition-all duration-200': true,
  };
}
</script>

<template>
  <div class="w-56 flex-shrink-0">
    <div class="space-y-2">
      <div
        v-for="item of settingTabs"
        :key="item.key"
        :class="getTabButtonClass(item.key)"
        class="flex items-start gap-3 p-3 rounded-lg cursor-pointer group"
        @click="switchTab(item.key)"
      >
        <component
          :is="item.icon"
          class="h-5 w-5 mt-0.5 flex-shrink-0"
        />
        <div class="flex-1 min-w-0">
          <div>
            {{ item.title }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
