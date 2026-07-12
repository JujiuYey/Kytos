<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { TestUnit } from '@/api/test-unit';
import { testUnitService } from '@/api/test-unit';
import { SagForm } from '@/components/sag/sag-form';
import { formFields } from './meta/form-schema';

import { toast } from 'vue-sonner';

onMounted(async () => {
  await fetchData();
});

async function fetchData() {
  try {
    // 获取第一项测试单位数据
    const units = await testUnitService.list();
    if (units.length > 0) {
      formData.value = units[0] || {
        id: '',
        name: '',
        address: '',
        contactPhone: '',
        fax: '',
        postcode: '',
      };
    }
  } catch (error) {
    toast.error(`${error}`);
  }
}

// 表单数据
const formData = ref<TestUnit>({
  id: '',
  name: '',
  address: '',
  contactPhone: '',
  fax: '',
  postcode: '',
});

// 保存表单
async function handleSave() {
  // 表单验证
  if (!formData.value.name) {
    toast.error('名称不能为空');
    return;
  }

  try {
    if (formData.value.id) {
      // 更新现有记录
      await testUnitService.update(formData.value.id, formData.value);
      toast.success('更新成功');
    } else {
      // 创建新记录
      const id = await testUnitService.create(formData.value);
      formData.value.id = id;
      toast.success('创建成功');
    }
  } catch (error) {
    toast.error(`${error}`);
  }
}
</script>

<template>
  <div class="container mx-auto p-6 max-w-5xl">
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-2">
        检测单位
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        检测单位管理、录入本单位基本信息
      </p>
    </div>

    <Card>
      <CardContent class="space-y-4">
        <SagForm
          :initial-values="formData"
          :fields="formFields"
          @submit="handleSave"
        />
      </CardContent>
    </Card>
  </div>
</template>
