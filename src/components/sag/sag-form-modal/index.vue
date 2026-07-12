<script setup lang="ts">
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import { SagForm } from '@/components/sag/sag-form';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Props } from './types';

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'submit', values: Recordable): void;
  (e: 'update:open', value: boolean): void;
}>();

const loading = ref(false);

const initialValues = computed(() => {
  return props.mode === 'edit' && props.formData ? props.formData : undefined;
});

const dialogTitle = computed(() => {
  return props.mode === 'create' ? `创建${props.title}` : `编辑${props.title}`;
});

const dialogDescription = computed(() => {
  return props.mode === 'create'
    ? `填写${props.title}信息来创建新${props.title}。点击保存按钮完成创建。`
    : `修改${props.title}信息。点击保存按钮完成更新。`;
});

const dialogSizeClass = computed(() => {
  const sizeMap = {
    'sm': '!max-w-sm',
    'md': '!max-w-md',
    'lg': '!max-w-lg',
    'xl': '!max-w-xl',
    '2xl': '!max-w-2xl',
    '3xl': '!max-w-3xl',
    '4xl': '!max-w-4xl',
  };
  return sizeMap[props.size || 'xl'];
});

// 处理表单提交
async function handleSubmit(values: Recordable) {
  try {
    loading.value = true;

    if (props.mode === 'create') {
      await props.createFunction(values);
    } else {
      await props.updateFunction(values);
    }

    emit('submit', values);
    handleClose();
  } catch (error) {
    toast.error(`${props.title}操作失败, ${error}`);
  } finally {
    loading.value = false;
  }
}

// 处理关闭
function handleClose() {
  if (!loading.value) {
    emit('update:open', false);
  }
}
</script>

<template>
  <Dialog :open="props.open" @update:open="handleClose">
    <DialogContent :class="dialogSizeClass">
      <DialogHeader>
        <DialogTitle>{{ dialogTitle }}</DialogTitle>
        <DialogDescription>{{ dialogDescription }}</DialogDescription>
      </DialogHeader>

      <SagForm
        :fields="fields"
        :initial-values="initialValues"
        :loading="loading"
        @submit="handleSubmit"
      />
    </DialogContent>
  </Dialog>
</template>
