<script setup lang="ts">
import { SagForm } from '@/components/sag/sag-form';
import { formFields, formConfig } from './meta';
import { useProjectContext } from '@/views/basic/bridge/composables/useProjectContext';

import { bridgeService } from '@/api/bridge';
import { toast } from 'vue-sonner';

const emit = defineEmits<{
  (e: 'saved'): void;
}>();

// 使用项目上下文
const projectContext = useProjectContext();
const { projectId, bridgeId } = toRefs(projectContext);

watch(bridgeId, bridgeId => {
  if (!bridgeId) {
    resetFormData();
  } else {
    fetchBridgeInfo();
  }
});

const defaultFormData = {
  id: '',
  admin_code: '',
  route_code: '',
  route_name: '',
  route_level: '',
  bridge_number: '',
  bridge_name: '',
  bridge_stake: '',
  function_type: '',
  crossed_road_name: '',
  crossed_road_stake: '',
  design_load: '',
  bridge_slope: '',
  curve_radius: '',
  completion_date: '',
  design_unit: '',
  construction_unit: '',
  supervision_unit: '',
  owner_unit: '',
  maintenance_unit: '',
};

async function fetchBridgeInfo() {
  if (!bridgeId.value) {
    return;
  }

  const bridgeInfo = await bridgeService.find(bridgeId.value);
  if (bridgeInfo) {
    formData.value = bridgeInfo;
  }
}

// 表单数据
const formData = ref<Recordable>(defaultFormData);

function resetFormData() {
  formData.value = defaultFormData;
}

// 提交
async function handleSave(values: Recordable) {
  if (bridgeId.value) {
    await handleUpdate(values);
  } else {
    await handleCreate(values);
  }
}

async function handleCreate(values: Recordable) {
  const params = {
    ...values,
    project_id: projectId.value,
  };

  try {
    await bridgeService.create(params as any);
    emit('saved');
    toast.success('保存成功');
  } catch (error) {
    console.error('保存失败:', error);
    toast.error('保存失败');
  }
}

async function handleUpdate(values: Recordable) {
  const params = {
    ...values,
    project_id: projectId.value,
  };

  try {
    await bridgeService.update(formData.value.id, params);
    emit('saved');
    toast.success('保存成功');
  } catch (error) {
    console.error('保存失败:', error);
    toast.error('保存失败');
  }
}
</script>

<template>
  <SagForm
    :initial-values="formData"
    :fields="formFields"
    :config="formConfig"
    @submit="handleSave"
    @create="handleCreate"
  />
</template>
