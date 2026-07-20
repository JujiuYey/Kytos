<script setup lang="ts">
import { reactive, watch } from 'vue';
import type { FormProps } from '../types';
import { Save, RotateCcw } from '@lucide/vue';
import FormField from './components/form-field.vue';
import { useFormButton } from './hooks/use-form-button';
import { useFormLayout } from './hooks/use-form-layout';
import { useFormValidation } from './hooks/use-form-validation';
import { useFieldVisible } from './hooks/use-field-visible';

const props = withDefaults(defineProps<FormProps>(), {
  loading: false,
  config: () => ({
    layout: {
      columns: 2,
      spacing: '1rem',
    },
  }),
});
const emit = defineEmits<{
  (e: 'submit', values: Recordable): void;
  (e: 'reset'): void;
}>();

// 表单数据
const formData = reactive<Recordable>({
  ...(props.initialValues || {}),
});

// 监听初始值变化
watch(
  () => props.initialValues,
  newValues => {
    if (newValues) {
      Object.assign(formData, newValues);
    }
  },
  { immediate: true },
);

// 表单验证
const { validate, errors, isFieldRequired } = useFormValidation(props, formData);

// 字段可见性
const { isFieldVisible } = useFieldVisible(formData);

// 表单按钮
const { submitButtonText, submitButtonShow, resetButtonText, resetButtonShow } =
  useFormButton(props);

// 表单布局
const { gridStyle, getFieldGridStyle } = useFormLayout(props);

// 更新字段值
function updateField(fieldName: string, value: any) {
  formData[fieldName] = value;
  delete errors[fieldName];
}

// 提交处理
async function handleSubmit() {
  const valid = await validate();

  if (!valid) {
    return;
  }

  emit('submit', { ...formData });
}

// 重置表单
function resetFormData() {
  Object.assign(formData, props.initialValues || {});
  Object.keys(errors).forEach(key => delete errors[key]);
}

// 暴露给父组件使用
defineExpose({
  formData,
  validate,
  resetForm: resetFormData,
  updateField,
});
</script>

<template>
  <div class="space-y-4">
    <div :style="gridStyle">
      <div
        v-for="field of fields"
        v-show="isFieldVisible(field)"
        :key="field.name"
        :style="getFieldGridStyle(field)"
        class="space-y-2"
      >
        <!-- 标签 -->
        <label
          v-if="field.label && field.type !== 'divider'"
          :for="field.name"
          class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {{ field.label }}
          <span v-if="isFieldRequired(field)" class="text-red-500">*</span>
        </label>

        <!-- 分割线标题 -->
        <div v-if="field.type === 'divider' && field.label" class="text-base font-bold">
          {{ field.label }}
        </div>

        <!-- 字段渲染器 -->
        <FormField
          :field="field"
          :model-value="formData[field.name]"
          @update:model-value="updateField(field.name, $event)"
        />

        <!-- 错误信息 -->
        <div v-if="errors[field.name]" class="text-sm text-red-500">
          {{ errors[field.name] }}
        </div>

        <!-- 帮助文本 -->
        <p v-if="field.helpText" class="text-sm text-muted-foreground">
          {{ field.helpText }}
        </p>
      </div>
    </div>

    <div class="flex justify-end space-x-2">
      <Button v-if="resetButtonShow" type="button" variant="outline" @click="resetFormData">
        <RotateCcw class="h-4 w-4 mr-2" />
        {{ resetButtonText }}
      </Button>
      <Button v-if="submitButtonShow" type="button" :disabled="loading" @click="handleSubmit">
        <Save class="h-4 w-4 mr-2" />
        {{ submitButtonText }}
      </Button>
    </div>
  </div>
</template>
