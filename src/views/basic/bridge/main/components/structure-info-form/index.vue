<script setup lang="ts">
import { SagForm } from '@/components/sag/sag-form';
import { formFields, formConfig } from './meta.ts';

// 表单数据
const formData = ref<Recordable>({
  id: '',
  name: '',
  address: '',
  contactPhone: '',
  fax: '',
  postcode: '',
});

// 提交
function handleSave() {

}
</script>

<template>
  <SagForm
    :initial-values="formData"
    :fields="formFields"
    :config="formConfig"
    @submit="handleSave"
  />
</template>
