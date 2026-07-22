<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { UploadIcon } from '@lucide/vue';
import { Button, type ButtonVariants } from '@/components/ui/button';
import { Loader } from '@/components/ai-elements/loader';
import { cn } from '@/lib/utils';
import type { SaveFileRequest, SavedFileResult } from '@/types';

interface Props {
  accept?: string;
  multiple?: boolean;
  maxFileSize?: number;
  maxFiles?: number;
  uploadHandler?: (request: SaveFileRequest) => Promise<SavedFileResult>;
  disabled?: boolean;
  label?: string;
  description?: string;
  enableDropZone?: boolean;
  dropzoneHint?: string;
  buttonVariant?: ButtonVariants['variant'];
  buttonSize?: ButtonVariants['size'];
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  label: '选择文件',
  dropzoneHint: '拖放文件到此处，或',
  enableDropZone: false,
  buttonVariant: 'default',
  buttonSize: 'default',
});

const emit = defineEmits<{
  (e: 'uploadSuccess', value: SavedFileResult | SavedFileResult[]): void;
  (e: 'uploadError', value: string): void;
}>();

const inputId = useId();
const inputRef = ref<HTMLInputElement | null>(null);
const busy = ref(false);
const errorMessage = ref('');
const isDragging = ref(false);
const dragCounter = ref(0);

const isDisabled = computed(() => Boolean(props.disabled) || busy.value);

const rootClass = computed(() => {
  if (!props.enableDropZone) {
    return 'space-y-2';
  }
  return cn(
    'rounded-md border-2 border-dashed p-6 text-center transition-colors',
    isDragging.value
      ? 'border-primary bg-primary/10'
      : 'border-muted-foreground/30 hover:border-muted-foreground/50',
  );
});

function openPicker() {
  if (isDisabled.value) {
    return;
  }
  errorMessage.value = '';
  inputRef.value?.click();
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = input.files ? Array.from(input.files) : [];
  input.value = '';
  if (!files.length) {
    return;
  }
  void uploadFiles(files);
}

function handleDragEnter(event: DragEvent) {
  if (!props.enableDropZone || isDisabled.value) {
    return;
  }
  event.preventDefault();
  dragCounter.value += 1;
  isDragging.value = true;
}

function handleDragOver(event: DragEvent) {
  if (!props.enableDropZone || isDisabled.value) {
    return;
  }
  event.preventDefault();
}

function handleDragLeave(event: DragEvent) {
  if (!props.enableDropZone) {
    return;
  }
  event.preventDefault();
  dragCounter.value = Math.max(0, dragCounter.value - 1);
  if (dragCounter.value === 0) {
    isDragging.value = false;
  }
}

function handleDrop(event: DragEvent) {
  if (!props.enableDropZone || isDisabled.value) {
    return;
  }
  event.preventDefault();
  dragCounter.value = 0;
  isDragging.value = false;
  const files = event.dataTransfer?.files ? Array.from(event.dataTransfer.files) : [];
  if (!files.length) {
    return;
  }
  errorMessage.value = '';
  void uploadFiles(files);
}

async function uploadFiles(files: File[]) {
  if (props.maxFileSize) {
    const oversized = files.filter(file => file.size > props.maxFileSize!);
    if (oversized.length) {
      const message = `文件超过大小限制: ${oversized.map(f => f.name).join(', ')}`;
      errorMessage.value = message;
      emit('uploadError', message);
      return;
    }
  }

  if (props.multiple && props.maxFiles && files.length > props.maxFiles) {
    const message = `最多只能选择 ${props.maxFiles} 个文件`;
    errorMessage.value = message;
    emit('uploadError', message);
    return;
  }

  busy.value = true;
  errorMessage.value = '';

  try {
    if (props.multiple) {
      const results: SavedFileResult[] = [];
      for (const file of files) {
        results.push(await saveSingle(file));
      }
      emit('uploadSuccess', results);
    } else {
      const target = files[0];
      if (!target) {
        return;
      }
      emit('uploadSuccess', await saveSingle(target));
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error) || '保存失败';
    errorMessage.value = message;
    emit('uploadError', message);
  } finally {
    busy.value = false;
  }
}

async function saveSingle(file: File): Promise<SavedFileResult> {
  const request: SaveFileRequest = {
    fileName: file.name,
    fileData: new Uint8Array(await file.arrayBuffer()),
    mimeType: file.type,
  };
  if (props.uploadHandler) {
    return await props.uploadHandler(request);
  }
  return await window.desktop.file.saveFile(request);
}
</script>

<template>
  <div
    :class="rootClass"
    @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver"
    @dragleave.prevent="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <input
      :id="inputId"
      ref="inputRef"
      type="file"
      class="hidden"
      :accept="accept"
      :multiple="multiple"
      @change="handleFileSelect"
    />

    <div v-if="enableDropZone" class="flex flex-col items-center gap-3 mb-4">
      <UploadIcon
        :class="[
          'size-10 transition-colors',
          isDragging ? 'text-primary' : 'text-muted-foreground',
        ]"
      />
      <p class="text-sm text-foreground">{{ dropzoneHint }}</p>
      <Button
        :variant="buttonVariant"
        :size="buttonSize"
        type="button"
        :disabled="isDisabled"
        @click="openPicker"
      >
        <Loader v-if="busy" :size="16" />
        <UploadIcon v-else />
        <span>{{ busy ? '保存中…' : label }}</span>
      </Button>
    </div>

    <Button
      v-else
      :variant="buttonVariant"
      :size="buttonSize"
      type="button"
      :disabled="isDisabled"
      @click="openPicker"
    >
      <Loader v-if="busy" :size="16" />
      <UploadIcon v-else />
      <span>{{ busy ? '保存中…' : label }}</span>
    </Button>

    <p v-if="description && !errorMessage" class="text-xs text-muted-foreground">
      {{ description }}
    </p>

    <p v-if="errorMessage" class="text-xs text-destructive" role="alert">
      {{ errorMessage }}
    </p>
  </div>
</template>
