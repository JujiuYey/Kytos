<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  UploadIcon,
  XIcon,
  FileIcon,
  ImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FileAudioIcon,
  FileArchiveIcon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import SagStatusBadge from '@/components/sag/status-badge.vue';
import type { UploadResult } from './types';
import { useAppStore } from '@/stores/app';
import type { SaveFileRequest } from '@/types';

// 文件项状态
interface FileItem {
  file: File;
  // 0: 等待中, 1: 上传中, 2: 成功, 3: 失败
  status: 0 | 1 | 2 | 3;
  progress: number;
  error?: string;
  result?: UploadResult;
}

// 基础组件属性
interface BaseProps {
  accept?: string;
  multiple?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  autoUpload?: boolean;
  showFileList?: boolean;
  showProgress?: boolean;
  showDropZone?: boolean;
  uploadHandler?: (request: SaveFileRequest) => Promise<UploadResult>;
}

const props = withDefaults(defineProps<BaseProps>(), {
  accept: '',
  multiple: false,
  maxFiles: 10,
  autoUpload: true,
  showFileList: true,
  showProgress: true,
  showDropZone: true,
});

// 事件
const emit = defineEmits<{
  (e: 'fileChange', value: File[]): void;
  (e: 'fileRemove', value: File): void;
  (e: 'uploadSuccess', value: UploadResult): void;
  (e: 'uploadError', value: string, file: File): void;
  (e: 'uploadProgress', value: number, file: File): void;
}>();

// 状态管理
const appStore = useAppStore();
const isDragging = ref(false);
const errorMessage = ref('');
const fileList = ref<FileItem[]>([]);
const uploading = ref(false);

// 计算属性
const successCount = computed(() => fileList.value.filter(item => item.status === 2).length);
const failCount = computed(() => fileList.value.filter(item => item.status === 3).length);
const totalProgressPercent = computed(() => {
  if (fileList.value.length === 0) {
    return 0;
  }
  const total = fileList.value.length;
  const completed = fileList.value.filter(item => item.status === 2 || item.status === 3).length;
  return Math.round((completed / total) * 100);
});

// 格式化接受的文件类型显示
const acceptFormatted = computed(() => {
  if (!props.accept) {
    return '所有文件';
  }
  return props.accept
    .split(',')
    .map(type => type.replace(/\*/g, '所有').replace(/\./g, ''))
    .join(', ');
});

// 处理拖放事件
function handleDrop(e: DragEvent) {
  isDragging.value = false;
  const files = e.dataTransfer?.files;
  if (files && files.length) {
    handleFiles(Array.from(files));
  }
}

// 处理文件选择
function handleFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = input.files;
  if (files && files.length) {
    handleFiles(Array.from(files));
    input.value = '';
  }
}

// 处理文件
async function handleFiles(files: File[]) {
  if (fileList.value.length + files.length > props.maxFiles) {
    errorMessage.value = `最多只能上传 ${props.maxFiles} 个文件`;
    return;
  }

  if (!props.multiple && files.length > 1) {
    errorMessage.value = '只允许上传一个文件';
    return;
  }

  const validFiles: File[] = [];
  for (const file of files) {
    if (validateFile(file)) {
      validFiles.push(file);
    }
  }

  if (validFiles.length === 0) {
    return;
  }

  // 添加到文件列表
  validFiles.forEach(file => {
    fileList.value.push({
      file,
      status: 0,
      progress: 0,
    });
  });

  emit(
    'fileChange',
    fileList.value.map(item => item.file),
  );

  if (props.autoUpload) {
    await startUpload();
  }
}

// 验证文件
function validateFile(file: File): boolean {
  if (props.accept && !isFileAccepted(file, props.accept)) {
    errorMessage.value = `文件类型不支持: ${file.name}`;
    return false;
  }

  if (props.maxFileSize && file.size > props.maxFileSize) {
    errorMessage.value = `文件过大: ${file.name} (最大: ${formatFileSize(props.maxFileSize)})`;
    return false;
  }

  return true;
}

// 检查文件是否被接受
function isFileAccepted(file: File, accept: string): boolean {
  const acceptTypes = accept.split(',');
  const fileName = file.name.toLowerCase();

  for (const type of acceptTypes) {
    const t = type.trim();
    if (t.startsWith('.')) {
      if (fileName.endsWith(t.toLowerCase())) {
        return true;
      }
    } else if (t.includes('/')) {
      if (file.type.startsWith(`${t.split('/')[0]}/`) || t === '*/*') {
        return true;
      }
    }
  }
  return false;
}

// 读取文件为 ArrayBuffer
async function readFileData(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// 开始上传
async function startUpload() {
  if (!appStore.workspacePath) {
    errorMessage.value = '存储路径未设置，请先在设置中配置存储路径';
    return;
  }

  uploading.value = true;
  errorMessage.value = '';

  // 找到所有待上传的文件
  const pendingFiles = fileList.value.filter(item => item.status === 0);

  for (const fileItem of pendingFiles) {
    fileItem.status = 1;
    fileItem.progress = 0;

    try {
      // 读取文件内容
      const fileData = await readFileData(fileItem.file);

      // 模拟进度更新
      fileItem.progress = 50;
      emit('uploadProgress', 50, fileItem.file);

      const saveRequest: SaveFileRequest = {
        fileName: fileItem.file.name,
        fileData,
        mimeType: fileItem.file.type,
      };
      const result = props.uploadHandler
        ? await props.uploadHandler(saveRequest)
        : await window.desktop.saveFile(saveRequest);

      // 更新进度和状态
      fileItem.progress = 100;
      fileItem.status = 2;
      fileItem.result = result;

      emit('uploadProgress', 100, fileItem.file);
      emit('uploadSuccess', result);
    } catch (error: unknown) {
      fileItem.status = 3;
      fileItem.error = getErrorMessage(error) || '上传失败';
      emit('uploadError', fileItem.error, fileItem.file);
    }
  }

  uploading.value = false;
}

// 移除文件
function removeFile(index: number) {
  const fileItem = fileList.value[index];
  if (fileItem) {
    emit('fileRemove', fileItem.file);
    fileList.value.splice(index, 1);
  }
}

// 重新上传文件
async function retryUpload(index: number) {
  const fileItem = fileList.value[index];
  if (fileItem && fileItem.status === 3) {
    fileItem.status = 0;
    fileItem.error = undefined;
    await startUpload();
  }
}

// 获取文件图标
function getFileIcon(file: File) {
  const type = file.type;
  const name = file.name.toLowerCase();

  if (type.startsWith('image/')) {
    return ImageIcon;
  }
  if (type.startsWith('video/')) {
    return FileVideoIcon;
  }
  if (type.startsWith('audio/')) {
    return FileAudioIcon;
  }
  if (type.includes('pdf') || name.endsWith('.pdf')) {
    return FileTextIcon;
  }
  if (
    type.includes('zip') ||
    type.includes('rar') ||
    type.includes('tar') ||
    name.endsWith('.zip') ||
    name.endsWith('.rar') ||
    name.endsWith('.tar')
  ) {
    return FileArchiveIcon;
  }
  return FileIcon;
}

// 格式化文件大小显示
function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

// 清空所有文件
function clearFiles() {
  fileList.value = [];
  errorMessage.value = '';
}

// 暴露方法
defineExpose({
  fileList,
  startUpload,
  clearFiles,
  handleFiles,
});
</script>

<template>
  <div class="space-y-4">
    <!-- 拖放区域 -->
    <div
      v-if="showDropZone"
      class="border-2 rounded-lg p-8 text-center transition-all"
      :class="[
        isDragging
          ? 'border-primary bg-primary/5'
          : 'border-input bg-background/50 hover:bg-background/80',
      ]"
      @dragover.prevent
      @dragenter.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <div v-if="!uploading" class="space-y-2">
        <UploadIcon class="mx-auto h-12 w-12 text-muted-foreground" />
        <div class="space-y-1">
          <p class="text-sm font-medium">拖放文件到此处，或</p>
          <label
            for="base-file-upload"
            class="inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2 text-sm cursor-pointer"
          >
            选择文件
          </label>
          <input
            id="base-file-upload"
            type="file"
            class="hidden"
            :accept="accept"
            :multiple="multiple"
            @change="handleFileSelect"
          />
        </div>
        <p class="text-xs text-muted-foreground">
          支持的格式: {{ acceptFormatted }}
          <template v-if="maxFileSize">
            ，最大文件大小: {{ formatFileSize(maxFileSize) }}
          </template>
          <template v-if="maxFiles"> ，最多 {{ maxFiles }} 个文件 </template>
        </p>
      </div>

      <!-- 上传进度 -->
      <div v-if="uploading && showProgress" class="space-y-2">
        <Progress :value="totalProgressPercent" class="h-2" />
        <p class="text-sm text-muted-foreground">正在上传... ({{ totalProgressPercent }}%)</p>
        <div class="flex justify-center space-x-2 text-xs text-muted-foreground">
          <span>上传中: {{ fileList.filter(item => item.status === 1).length }}</span>
          <span>成功: {{ successCount }}</span>
          <span>失败: {{ failCount }}</span>
        </div>
      </div>
    </div>

    <!-- 文件列表 -->
    <div v-if="fileList.length && showFileList" class="space-y-3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium">文件列表 ({{ fileList.length }}/{{ maxFiles }})</h3>
        <div class="flex space-x-2">
          <Button
            v-if="!autoUpload && fileList.filter(item => item.status === 0).length > 0"
            size="sm"
            @click="startUpload"
          >
            开始上传
          </Button>
          <Button variant="outline" size="sm" @click="clearFiles"> 清空 </Button>
        </div>
      </div>

      <div class="space-y-2">
        <div
          v-for="(fileItem, index) of fileList"
          :key="index"
          class="flex items-center justify-between rounded-md border p-3"
        >
          <div class="flex items-center space-x-3 flex-1 min-w-0">
            <component
              :is="getFileIcon(fileItem.file)"
              class="h-8 w-8 text-muted-foreground flex-shrink-0"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2">
                <p class="text-sm font-medium truncate">
                  {{ fileItem.file.name }}
                </p>
                <SagStatusBadge
                  :tone="
                    fileItem.status === 2
                      ? 'success'
                      : fileItem.status === 3
                        ? 'error'
                        : fileItem.status === 1
                          ? 'info'
                          : 'warning'
                  "
                >
                  {{
                    fileItem.status === 0
                      ? '等待中'
                      : fileItem.status === 1
                        ? '上传中'
                        : fileItem.status === 2
                          ? '成功'
                          : '失败'
                  }}
                </SagStatusBadge>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ formatFileSize(fileItem.file.size) }}
                <template v-if="fileItem.status === 2 && fileItem.result">
                  •
                  <a
                    :href="fileItem.result.url"
                    target="_blank"
                    class="text-primary hover:underline"
                    >查看文件</a
                  >
                </template>
                <template v-if="fileItem.status === 3 && fileItem.error">
                  • {{ fileItem.error }}
                </template>
              </p>
            </div>
          </div>

          <div class="flex items-center space-x-2 flex-shrink-0">
            <div v-if="fileItem.status === 1 && showProgress" class="w-20">
              <Progress :value="fileItem.progress" class="h-1" />
            </div>
            <Button
              v-if="fileItem.status === 3"
              variant="outline"
              size="sm"
              @click="retryUpload(index)"
            >
              重试
            </Button>
            <Button variant="ghost" size="sm" class="h-7 w-7 p-0" @click="removeFile(index)">
              <XIcon class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 错误信息 -->
    <p v-if="errorMessage" class="text-sm text-destructive">
      {{ errorMessage }}
    </p>
  </div>
</template>
