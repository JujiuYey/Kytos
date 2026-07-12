<script setup lang="ts">
import { ref, computed } from 'vue';
import { UploadIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import FileUpload from './FileUpload.vue';
import type { UploadResult } from './types';

// 头像专用配置
const props = withDefaults(defineProps<{
  modelValue?: string;
  size?: 'sm' | 'md' | 'lg';
  showMaskButton?: boolean;
  showUploadButton?: boolean;
  showUploadText?: boolean;
}>(), {
  size: 'md',
  showMaskButton: true,
  showUploadButton: false,
  showUploadText: false,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'uploadSuccess', value: UploadResult): void;
  (e: 'uploadError', value: string, file: File): void;
}>();

// 头像尺寸配置
const sizeConfig = {
  sm: { container: 'w-16 h-16', icon: 'w-6 h-6', text: 'text-xs' },
  md: { container: 'w-24 h-24', icon: 'w-8 h-8', text: 'text-sm' },
  lg: { container: 'w-32 h-32', icon: 'w-12 w-12', text: 'text-base' },
};

// 预览URL
const previewUrl = ref<string>('');

// 文件输入引用
const fileInputRef = ref<HTMLInputElement>();

// 基础上传组件引用
const baseUploadRef = ref<InstanceType<typeof FileUpload>>();

// 处理上传成功
function handleUploadSuccess(result: UploadResult) {
  previewUrl.value = result.url;
  emit('update:modelValue', result.url);
  emit('uploadSuccess', result);
}

// 处理上传错误
function handleUploadError(error: string, file: File) {
  emit('uploadError', error, file);
}

// 触发文件选择
function triggerFileSelect() {
  fileInputRef.value?.click();
}

// 处理文件选择
function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const files = Array.from(input.files);
    if (baseUploadRef.value?.handleFiles) {
      baseUploadRef.value.handleFiles(files);
    }
  }
  // 清空输入值，允许重复选择同一文件
  input.value = '';
}

// 获取头像显示文本
const avatarText = computed(() => {
  if (props.modelValue || previewUrl.value) {
    return '';
  }
  return '头像';
});
</script>

<template>
  <div class="flex flex-col items-center space-y-4">
    <!-- 头像预览区域 -->
    <div class="relative group">
      <Avatar :class="sizeConfig[size].container">
        <AvatarImage :src="modelValue || previewUrl" />
        <AvatarFallback :class="sizeConfig[size].text">
          {{ avatarText }}
        </AvatarFallback>
      </Avatar>

      <!-- 上传按钮覆盖层 -->
      <div
        v-if="showMaskButton"
        class="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        role="button"
        tabindex="0"
        @click.prevent="triggerFileSelect"
      >
        <UploadIcon class="w-6 h-6 text-white" />
      </div>
    </div>

    <!-- 基础文件上传组件 -->
    <FileUpload
      ref="baseUploadRef"
      accept="image/*"
      :multiple="false"
      :max-files="1"
      :max-file-size="5 * 1024 * 1024"
      :show-file-list="false"
      :show-drop-zone="false"
      :auto-upload="true"
      class="hidden"
      @upload-success="handleUploadSuccess"
      @upload-error="handleUploadError"
    />

    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      class="hidden"
      accept="image/*"
      @change="handleFileSelect"
    />

    <!-- 上传提示 -->
    <div class="text-center space-y-2">
      <p v-if="showUploadText" class="text-xs text-muted-foreground">
        支持的格式: image/所有, 最大文件大小: 5MB, 最多1个文件
      </p>
      <Button
        v-if="showUploadButton"
        type="button"
        variant="outline"
        size="sm"
        @click="triggerFileSelect"
      >
        选择文件
      </Button>
    </div>
  </div>
</template>
