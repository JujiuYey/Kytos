<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import StructType from './components/struct-type/index.vue';
import DiseaseRecordCard from './components/record-card/record-card.vue';
import type { DiseaseRecord } from '@/views/report/data-entry/types';
// import { useProjectContext } from '../composables/useProjectContext';
import { Plus } from 'lucide-vue-next';

// 暂时不需要 emit，后期可能用于刷新等操作
// const emit = defineEmits<{
//   (e: 'refresh'): void;
// }>();

// 使用项目上下文
// const projectContext = useProjectContext();
// const { bridgeId } = toRefs(projectContext);

const activeTab = ref('upper');
const activeTabName = computed(() => {
  switch (activeTab.value) {
    case 'upper':
      return '上部结构';
    case 'lower':
      return '下部结构';
    case 'deck':
      return '桥面系';
    default:
      return '';
  }
});

// 病害记录列表
const records = ref<DiseaseRecord[]>([]);

// Mock 数据（后期接入真实 API）
function getMockData(): DiseaseRecord[] {
  return [
    {
      id: 'record_1',
      componentNumber: '1-02-1-1',
      diseaseLocation: '1#桥面板',
      diseaseType: '剥落、蜂窝麻面',
      diseaseDescription: '桥面板底部出现局部剥落，面积约0.05m²，深度2-3cm',
      quantityValue: 0.05,
      quantityUnit: 'm²',
      evaluationStandard: 3,
      photoNumber: '照片5-1',
      photos: [],
    },
    {
      id: 'record_2',
      componentNumber: '1-02-1-2',
      diseaseLocation: '2#主梁',
      diseaseType: '裂缝',
      diseaseDescription: '主梁腹板发现横向裂缝，长度约30cm，宽度0.2mm',
      quantityValue: 30,
      quantityUnit: 'cm',
      evaluationStandard: 4,
      photoNumber: '照片5-2',
      photos: [],
    },
  ];
}

// 获取检查结果数据
async function fetchRecords() {
  try {
    // TODO: 后期接入真实 API
    // const data = await api.getRecords(bridgeId.value, activeTab.value);
    // records.value = data;

    // 暂时使用 Mock 数据
    records.value = getMockData();
  } catch (error) {
    console.error('获取检查结果失败:', error);
    records.value = [];
  }
}

// 初始化加载数据
onMounted(() => {
  fetchRecords();
});

// 监听 tab 切换，重新获取数据
watch(activeTab, () => {
  fetchRecords();
});

// 添加新记录
function handleCreate() {
  const newRecord: DiseaseRecord = {
    id: `record_${Date.now()}`,
    componentNumber: '',
    diseaseLocation: '',
    diseaseType: '',
    diseaseDescription: '',
    quantityValue: undefined,
    quantityUnit: '',
    evaluationStandard: undefined,
    photoNumber: '',
    photos: [],
  };
  records.value.push(newRecord);
}

// 更新记录（卡片保存后同步到列表）
function updateRecord(id: string, data: DiseaseRecord) {
  const index = records.value.findIndex(r => r.id === id);
  if (index > -1) {
    records.value[index] = data;
    console.log('✅ 记录已更新:', data);
    // TODO: 这里可以添加成功提示
  }
}

// 删除记录
function deleteRecord(id: string) {
  const index = records.value.findIndex(r => r.id === id);
  if (index > -1) {
    records.value.splice(index, 1);
    console.log('✅ 记录已删除:', id);
    // TODO: 这里可以添加成功提示
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col p-6 overflow-hidden">
    <div class="mb-6 flex-shrink-0">
      <h1 class="text-2xl font-bold mb-2">
        检查结果
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        检查结果录入
      </p>
    </div>

    <div class="flex gap-6 flex-1 min-h-0">
      <StructType v-model:tab="activeTab" />

      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 标题和操作栏 -->
        <div class="flex items-center justify-between bg-white dark:bg-gray-800 p-4 flex-shrink-0">
          <div>
            <h2 class="text-2xl font-bold">
              {{ activeTabName }}检查结果表
            </h2>
            <p class="text-sm text-muted-foreground mt-1">
              请填写病害检查详细信息
            </p>
          </div>

          <div class="flex gap-2">
            <Button variant="outline" @click="handleCreate">
              <Plus class="w-4 h-4 mr-1" />
              添加检查结果
            </Button>
          </div>
        </div>

        <!-- 表单内容区域 - 可滚动 -->
        <div class="flex-1 overflow-y-auto p-4">
          <!-- 记录列表 -->
          <div class="space-y-4">
            <DiseaseRecordCard
              v-for="(record, index) of records"
              :key="record.id"
              :record="record"
              :index="index"
              @update="updateRecord"
              @delete="deleteRecord"
            />
          </div>

          <!-- 空状态 -->
          <Card v-if="records.length === 0" class="p-12 text-center">
            <div class="text-muted-foreground">
              <p class="text-lg mb-2">
                暂无病害记录
              </p>
              <p class="text-sm">
                点击上方按钮添加新的病害记录
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>
