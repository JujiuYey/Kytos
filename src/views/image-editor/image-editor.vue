<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue';
import { toast } from 'vue-sonner';
import type { ExportFileRequest } from '@/types';
import EditorSettings from './components/editor-settings.vue';
import EditorStage from './components/editor-stage.vue';
import type { CompressionMode, CropRatio, CropRect, ExportFormat } from './components/types';

interface EncodedImage {
  blob: Blob;
  height: number;
  quality: number | null;
  width: number;
}

const TARGET_MIN_QUALITY = 0.4;
const QUALITY_SEARCH_STEPS = 8;
const MAX_RESIZE_ATTEMPTS = 12;

const props = defineProps<{
  fileName: string;
  mimeType: string;
  sourceUrl: string;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
}>();

const editorStageRef = useTemplateRef<InstanceType<typeof EditorStage>>('editorStageRef');
const editorSourceUrl = ref('');
const sourceWidth = ref(0);
const sourceHeight = ref(0);
const isLoading = ref(true);
const errorMessage = ref('');
const isExporting = ref(false);
const cropRatio = ref<CropRatio>('free');
const flipX = ref(false);
const flipY = ref(false);
const outputWidth = ref(0);
const outputHeight = ref(0);
const lockRatio = ref(true);
const exportFormat = ref<ExportFormat>('png');
const compressionMode = ref<CompressionMode>('quality');
const quality = ref(90);
const targetSizeKb = ref(500);
const crop = reactive<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
let sourceObjectUrl: string | null = null;

const outputAspect = computed(() => crop.width / Math.max(crop.height, 1));
const extension = computed(() => (exportFormat.value === 'jpeg' ? 'jpg' : exportFormat.value));
const outputMimeType = computed(() => `image/${exportFormat.value}`);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function syncOutputFromCrop(): void {
  outputWidth.value = Math.max(1, Math.round(crop.width));
  outputHeight.value = Math.max(1, Math.round(crop.height));
}

function resetCrop(): void {
  crop.x = 0;
  crop.y = 0;
  crop.width = sourceWidth.value;
  crop.height = sourceHeight.value;
  syncOutputFromCrop();
}

function fitCropToRatio(nextRatio: CropRatio): void {
  cropRatio.value = nextRatio;
  if (editorStageRef.value?.setCropRatio(nextRatio) || nextRatio === 'free' || !sourceWidth.value) {
    return;
  }
  const [width = 1, height = 1] = nextRatio.split(':').map(Number);
  const ratio = width / height;
  let nextWidth = crop.width;
  let nextHeight = nextWidth / ratio;
  if (nextHeight > sourceHeight.value) {
    nextHeight = sourceHeight.value;
    nextWidth = nextHeight * ratio;
  }
  if (nextWidth > sourceWidth.value) {
    nextWidth = sourceWidth.value;
    nextHeight = nextWidth / ratio;
  }
  crop.width = nextWidth;
  crop.height = nextHeight;
  crop.x = (sourceWidth.value - nextWidth) / 2;
  crop.y = (sourceHeight.value - nextHeight) / 2;
  syncOutputFromCrop();
}

function updateOutputWidth(value: number): void {
  const nextWidth = clamp(Math.round(value || 1), 1, 16_000);
  outputWidth.value = nextWidth;
  if (lockRatio.value) {
    outputHeight.value = clamp(
      Math.round(nextWidth / Math.max(outputAspect.value, 0.001)),
      1,
      16_000,
    );
  }
}

function updateOutputHeight(value: number): void {
  const nextHeight = clamp(Math.round(value || 1), 1, 16_000);
  outputHeight.value = nextHeight;
  if (lockRatio.value) {
    outputWidth.value = clamp(Math.round(nextHeight * outputAspect.value), 1, 16_000);
  }
}

function updateCropWidth(value: number): void {
  if (editorStageRef.value?.setCropWidth(value || 24)) return;
  crop.width = clamp(value || 24, 24, sourceWidth.value);
  crop.x = Math.min(crop.x, sourceWidth.value - crop.width);
  syncOutputFromCrop();
}

function updateCropHeight(value: number): void {
  if (editorStageRef.value?.setCropHeight(value || 24)) return;
  crop.height = clamp(value || 24, 24, sourceHeight.value);
  crop.y = Math.min(crop.y, sourceHeight.value - crop.height);
  syncOutputFromCrop();
}

function updateQuality(value: number): void {
  quality.value = clamp(Math.round(value || 90), 10, 100);
}

function updateTargetSize(value: number): void {
  targetSizeKb.value = clamp(Math.round(value || 500), 10, 102_400);
}

function rotateImage(direction: 'left' | 'right'): void {
  void editorStageRef.value?.rotateImage(direction);
}

function toggleFlip(axis: 'x' | 'y'): void {
  if (!editorStageRef.value?.flipImage(axis)) return;
  if (axis === 'x') flipX.value = !flipX.value;
  if (axis === 'y') flipY.value = !flipY.value;
}

function handleCropUpdate(next: CropRect): void {
  crop.x = next.x;
  crop.y = next.y;
  crop.width = next.width;
  crop.height = next.height;
  syncOutputFromCrop();
}

function resetEditor(): void {
  flipX.value = false;
  flipY.value = false;
  cropRatio.value = 'free';
  resetCrop();
  void editorStageRef.value?.resetEditor('free');
  compressionMode.value = 'quality';
  quality.value = 90;
  targetSizeKb.value = 500;
  exportFormat.value = 'png';
  toast.success('编辑已重置');
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '') || '未命名图片';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function encodeCanvas(canvas: HTMLCanvasElement, encodingQuality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      result => (result ? resolve(result) : reject(new Error('图片导出失败'))),
      outputMimeType.value,
      encodingQuality,
    );
  });
}

async function renderOutputCanvas(width: number, height: number): Promise<HTMLCanvasElement> {
  const canvas = await editorStageRef.value?.renderCanvas({
    width,
    height,
    fillColor: exportFormat.value === 'jpeg' ? '#ffffff' : undefined,
  });
  if (!canvas) throw new Error('无法创建裁剪画布');
  return canvas;
}

async function encodeForTargetSize(
  canvas: HTMLCanvasElement,
  targetBytes: number,
): Promise<{ blob: Blob; quality: number | null }> {
  if (exportFormat.value === 'png') {
    return { blob: await encodeCanvas(canvas), quality: null };
  }

  const maximumQualityBlob = await encodeCanvas(canvas, 1);
  if (maximumQualityBlob.size <= targetBytes) {
    return { blob: maximumQualityBlob, quality: 1 };
  }

  const minimumQualityBlob = await encodeCanvas(canvas, TARGET_MIN_QUALITY);
  if (minimumQualityBlob.size > targetBytes) {
    return { blob: minimumQualityBlob, quality: TARGET_MIN_QUALITY };
  }

  let lowerQuality = TARGET_MIN_QUALITY;
  let upperQuality = 1;
  let bestBlob = minimumQualityBlob;
  let bestQuality = TARGET_MIN_QUALITY;
  for (let step = 0; step < QUALITY_SEARCH_STEPS; step += 1) {
    const candidateQuality = (lowerQuality + upperQuality) / 2;
    const candidateBlob = await encodeCanvas(canvas, candidateQuality);
    if (candidateBlob.size <= targetBytes) {
      lowerQuality = candidateQuality;
      bestBlob = candidateBlob;
      bestQuality = candidateQuality;
    } else {
      upperQuality = candidateQuality;
    }
  }
  return { blob: bestBlob, quality: bestQuality };
}

async function createTargetSizeOutput(): Promise<EncodedImage> {
  const targetBytes = targetSizeKb.value * 1024;
  let width = outputWidth.value;
  let height = outputHeight.value;

  for (let attempt = 0; attempt < MAX_RESIZE_ATTEMPTS; attempt += 1) {
    const canvas = await renderOutputCanvas(width, height);
    const encoded = await encodeForTargetSize(canvas, targetBytes);
    if (encoded.blob.size <= targetBytes) {
      return { ...encoded, width, height };
    }

    const resizeRatio = clamp(Math.sqrt(targetBytes / encoded.blob.size) * 0.94, 0.1, 0.9);
    const nextWidth = Math.max(1, Math.floor(width * resizeRatio));
    const nextHeight = Math.max(1, Math.floor(height * resizeRatio));
    if (nextWidth === width && nextHeight === height) break;
    width = nextWidth;
    height = nextHeight;
  }

  throw new Error('无法在有效图片尺寸内达到目标文件大小');
}

async function createExportOutput(): Promise<EncodedImage> {
  if (compressionMode.value === 'target-size') return createTargetSizeOutput();

  const canvas = await renderOutputCanvas(outputWidth.value, outputHeight.value);
  const encodingQuality = exportFormat.value === 'png' ? undefined : quality.value / 100;
  return {
    blob: await encodeCanvas(canvas, encodingQuality),
    height: outputHeight.value,
    quality: encodingQuality ?? null,
    width: outputWidth.value,
  };
}

async function exportImage(): Promise<void> {
  if (!editorSourceUrl.value || !editorStageRef.value || isExporting.value) return;
  isExporting.value = true;
  try {
    const output = await createExportOutput();
    const request: ExportFileRequest = {
      fileName: `${stripExtension(props.fileName)}-编辑.${extension.value}`,
      fileData: new Uint8Array(await output.blob.arrayBuffer()),
      mimeType: outputMimeType.value,
    };
    const result = await window.desktop.file.exportFile(request);
    if (!result.canceled) {
      const qualityLabel = output.quality ? ` · 质量 ${Math.round(output.quality * 100)}%` : '';
      toast.success(
        `图片已导出：${formatFileSize(output.blob.size)} · ${output.width} × ${output.height} px${qualityLabel}`,
      );
    }
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : '图片导出失败');
  } finally {
    isExporting.value = false;
  }
}

async function loadImage(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = '';
  let nextObjectUrl: string | null = null;
  try {
    const response = await fetch(props.sourceUrl);
    if (!response.ok) throw new Error('原图读取失败');
    const blob = await response.blob();
    nextObjectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = nextObjectUrl;
    await image.decode();
    if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
    sourceObjectUrl = nextObjectUrl;
    editorSourceUrl.value = nextObjectUrl;
    nextObjectUrl = null;
    sourceWidth.value = image.naturalWidth;
    sourceHeight.value = image.naturalHeight;
    exportFormat.value =
      props.mimeType === 'image/jpeg' ? 'jpeg' : props.mimeType === 'image/webp' ? 'webp' : 'png';
    resetCrop();
  } catch (error: unknown) {
    if (nextObjectUrl) URL.revokeObjectURL(nextObjectUrl);
    errorMessage.value = error instanceof Error ? error.message : '原图读取失败';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  void loadImage();
});

onBeforeUnmount(() => {
  if (sourceObjectUrl) URL.revokeObjectURL(sourceObjectUrl);
});
</script>

<template>
  <div
    class="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_400px] gap-4 overflow-hidden bg-background p-4 sm:p-5"
  >
    <EditorStage
      ref="editorStageRef"
      :source-url="editorSourceUrl"
      :crop-ratio="cropRatio"
      :is-loading="isLoading"
      :error-message="errorMessage"
      @back="emit('back')"
      @error="errorMessage = $event"
      @update:crop="handleCropUpdate"
    />

    <EditorSettings
      :crop="crop"
      :crop-ratio="cropRatio"
      :flip-x="flipX"
      :flip-y="flipY"
      :source-width="sourceWidth"
      :source-height="sourceHeight"
      :output-width="outputWidth"
      :output-height="outputHeight"
      :lock-ratio="lockRatio"
      :export-format="exportFormat"
      :compression-mode="compressionMode"
      :quality="quality"
      :target-size-kb="targetSizeKb"
      :is-loading="isLoading"
      :has-error="Boolean(errorMessage)"
      :is-exporting="isExporting"
      @reset="resetEditor"
      @export="exportImage"
      @rotate="rotateImage"
      @flip="toggleFlip"
      @crop-width-input="updateCropWidth"
      @crop-height-input="updateCropHeight"
      @update:crop-ratio="fitCropToRatio"
      @output-width-input="updateOutputWidth"
      @output-height-input="updateOutputHeight"
      @update:lock-ratio="lockRatio = $event"
      @update:export-format="exportFormat = $event"
      @update:compression-mode="compressionMode = $event"
      @quality-input="updateQuality"
      @target-size-input="updateTargetSize"
    />
  </div>
</template>
