<script setup lang="ts">
import { ref } from 'vue';
import FormType from './components/form-type/index.vue';
import BasicInfoForm from './components/basic-info-form/index.vue';
import ArchiveDocumentsForm from './components/archive-documents-form/index.vue';
import TechnicalIndicatorsForm from './components/technical-indicators-form/index.vue';
import OthersForm from './components/others-form/index.vue';
import StructureInfoForm from './components/structure-info-form/index.vue';
import { Section } from './enum/section';
import { useProjectContext } from '../composables/useProjectContext';

const emit = defineEmits<{
  (e: 'refresh'): void;
}>();

// 使用项目上下文
const projectContext = useProjectContext();
const { bridgeId } = toRefs(projectContext);

const activeTab = ref(Section.BasicInfo);

function handleBasicInfoSaved() {
  emit('refresh');
}
</script>

<template>
  <div class="flex-1 p-6 overflow-y-auto">
    <div class="sticky top-6 mb-6">
      <h1 class="text-2xl font-bold mb-2">
        {{ bridgeId ? `修改桥梁信息` : '新建桥梁信息' }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        桥梁信息管理、录入本单位基本信息
      </p>
    </div>

    <div class="flex gap-6">
      <FormType v-model:tab="activeTab" />

      <Card class="flex-1">
        <CardContent class="space-y-4">
          <BasicInfoForm
            v-if="activeTab === Section.BasicInfo"
            @saved="handleBasicInfoSaved"
          />
          <ArchiveDocumentsForm v-else-if="activeTab === Section.ArchiveDocuments" />
          <TechnicalIndicatorsForm v-else-if="activeTab === Section.TechnicalIndicators" />
          <OthersForm v-else-if="activeTab === Section.Others" />
          <StructureInfoForm v-else-if="activeTab === Section.StructureInfo" />

          <div
            v-else
            class="flex items-center justify-center h-64 text-muted-foreground"
          >
            暂无表单字段
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
