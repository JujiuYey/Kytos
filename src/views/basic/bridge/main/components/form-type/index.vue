<script setup lang="ts">
import {
  Server,
  Database,
  FileText,
  History,
  Wrench,
  Construction,
  MoreHorizontal,
} from 'lucide-vue-next';
import { useProjectContext } from '@/views/basic/bridge/composables/useProjectContext';
import { Section } from '../../enum/section';
import { toast } from 'vue-sonner';

const props = defineProps<{
  tab: string;
}>();

const emit = defineEmits<{
  (e: 'update:tab', tabKey: string): void;
}>();

// 使用项目上下文
const projectContext = useProjectContext();
const { bridgeId } = toRefs(projectContext);

const activeTab = computed({
  get: () => props.tab,
  set: (value: string) => emit('update:tab', value),
});

const settingTabs = [
  {
    key: Section.BasicInfo,
    title: '基本信息',
    icon: Server,
    description: '行政识别数据',
  },
  {
    key: Section.TechnicalIndicators,
    title: '桥梁技术指标',
    icon: Database,
    description: '桥梁技术指标',
  },
  {
    key: Section.StructureInfo,
    title: '桥梁结构信息',
    icon: Construction,
    description: '桥梁结构信息',
  },
  {
    key: Section.ArchiveDocuments,
    title: '桥梁档案资料',
    icon: FileText,
    description: '桥梁档案资料',
  },
  {
    key: Section.InspectionHistory,
    title: '桥梁检测评定历史',
    icon: History,
    description: '桥梁检测评定历史',
  },
  {
    key: Section.MaintenanceRecords,
    title: '养护处治记录',
    icon: Wrench,
    description: '养护处治记录',
  },
  {
    key: Section.Others,
    title: '其他',
    icon: MoreHorizontal,
    description: '其他',
  },
];

// 切换标签
function switchTab(tabKey: string) {
  if (!bridgeId.value) {
    toast.warning('请先录入桥梁基本信息');
    return;
  }

  activeTab.value = tabKey;
  emit('update:tab', tabKey);
}

// 获取标签按钮样式
function getTabButtonClass(tabKey: string) {
  return {
    'bg-primary text-primary-foreground shadow-sm': activeTab.value === tabKey,
    'hover:bg-accent hover:text-accent-foreground': activeTab.value !== tabKey,
    'transition-all duration-200': true,
    'text-muted-foreground': !bridgeId.value,
    'font-medium text-sm': true,
  };
}
</script>

<template>
  <div class="w-64 flex-shrink-0">
    <div class="sticky top-28">
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
            <div class="text-xs opacity-70 mt-1 line-clamp-2">
              {{ item.description }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
