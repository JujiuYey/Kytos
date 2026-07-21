<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import type { FormField, SelectOption } from '@/components/sag/sag-form/types';
import { usePlaceholder } from '../hooks/use-placeholder';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

import { FileUpload } from '@/components/sag/file-upload';
import { TagsInput, TagsInputInput, TagsInputItem, TagsInputItemDelete, TagsInputItemText } from '@/components/ui/tags-input';
import DatePicker from '@/components/sag/sag-date-picker/index.vue';
import SagSelect from '@/components/sag/sag-select/index.vue';
import { Separator } from '@/components/ui/separator';

interface Props {
  field: FormField;
  modelValue: any;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:modelValue']);

// 🔥 通用更新处理
function handleUpdate(value: any) {
  emit('update:modelValue', value);
}

// 🔥 处理异步 options
const selectOptions = ref<SelectOption[]>([]);
const isLoadingOptions = ref(false);

watchEffect(async () => {
  if (props.field.type === 'select' && props.field.options) {
    if (typeof props.field.options === 'function') {
      isLoadingOptions.value = true;
      try {
        selectOptions.value = await props.field.options();
      } catch (error) {
        console.error('Failed to load select options:', error);
        selectOptions.value = [];
      } finally {
        isLoadingOptions.value = false;
      }
    } else {
      selectOptions.value = props.field.options;
    }
  }
});

// 计算公共属性
const commonProps = computed(() => {
  const { placeholder, disabled, readonly, props: fieldProps, label, type } = props.field;

  // 自动生成占位符
  const autoPlaceholder = placeholder || usePlaceholder(label, type);

  return {
    placeholder: autoPlaceholder,
    disabled: disabled || readonly,
    ...fieldProps,
  };
});

// 计算文件上传组件的属性
const fileUploadProps = computed(() => {
  const { props: fieldProps } = props.field;

  return {
    'modelValue': props.modelValue,
    'placeholder': props.field.placeholder || usePlaceholder(props.field.label, props.field.type),
    'disabled': props.field.disabled || props.field.readonly,
    'onUpdate:modelValue': handleUpdate,
    // 确保有默认的上传URL，或者从fieldProps中获取
    'uploadUrl': fieldProps?.uploadUrl || '/file/upload',
    'accept': fieldProps?.accept || '',
    'multiple': fieldProps?.multiple || false,
    'maxFileSize': fieldProps?.maxFileSize,
    'uploadParams': fieldProps?.uploadParams || {},
    'uploadHeaders': fieldProps?.uploadHeaders || {},
  };
});

// 🔥 计算 tags-input 的标签列表，确保始终返回数组
const tagsValue = computed({
  get: () => {
    const value = props.modelValue;
    // 如果是数组，直接返回
    if (Array.isArray(value)) {
      return value;
    }
    // 如果是空值，返回空数组
    if (!value) {
      return [];
    }
    // 如果是其他类型，返回空数组（避免遍历字符串等情况）
    return [];
  },
  set: val => {
    emit('update:modelValue', val);
  },
});
</script>

<template>
  <div>
    <!-- 文本输入框 -->
    <Input
      v-if="field.type === 'text' || field.type === 'email' || field.type === 'password' || field.type === 'number' || field.type === 'tel' || field.type === 'url'"
      :type="field.type"
      :model-value="modelValue"
      v-bind="commonProps"
      @update:model-value="handleUpdate"
    />

    <!-- 多行文本输入框 -->
    <Textarea
      v-else-if="field.type === 'textarea'"
      :model-value="modelValue"
      v-bind="commonProps"
      @update:model-value="handleUpdate"
    />

    <!-- 下拉选择框 -->
    <SagSelect
      v-else-if="field.type === 'select'"
      :model-value="modelValue"
      :options="selectOptions"
      v-bind="{
        ...commonProps,
        disabled: commonProps.disabled || isLoadingOptions,
      }"
      @update:model-value="handleUpdate"
    />

    <!-- 开关 -->
    <Switch
      v-else-if="field.type === 'switch'"
      :checked="modelValue"
      v-bind="commonProps"
      @update:checked="handleUpdate"
    />

    <!-- 复选框 -->
    <Checkbox
      v-else-if="field.type === 'checkbox'"
      :checked="modelValue"
      v-bind="commonProps"
      @update:checked="handleUpdate"
    />

    <!-- 文件上传 -->
    <FileUpload
      v-else-if="field.type === 'file-upload'"
      v-bind="fileUploadProps"
    />

    <!-- 标签输入 -->
    <TagsInput
      v-else-if="field.type === 'tags-input'"
      v-model="tagsValue"
      v-bind="commonProps"
    >
      <TagsInputItem
        v-for="item of tagsValue"
        :key="item"
        :value="item"
      >
        <TagsInputItemText />
        <TagsInputItemDelete />
      </TagsInputItem>
      <TagsInputInput :placeholder="field.placeholder" />
    </TagsInput>

    <!-- 日期选择器 -->
    <DatePicker
      v-else-if="field.type === 'date'"
      :model-value="modelValue"
      v-bind="commonProps"
      @update:model-value="handleUpdate"
    />

    <!-- 分割线 -->
    <div v-else-if="field.type === 'divider'">
      <Separator class="my-4" />
    </div>

    <!-- 默认文本输入框 -->
    <Input
      v-else
      type="text"
      :model-value="modelValue"
      v-bind="commonProps"
      @update:model-value="handleUpdate"
    />
  </div>
</template>
