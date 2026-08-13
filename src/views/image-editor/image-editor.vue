<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, useTemplateRef } from 'vue';
import { toast } from 'vue-sonner';
import { Download, RotateCcw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ExportFileRequest } from '@/types';
import CompressionSettings from './components/compression-settings.vue';
import CropSettings from './components/crop-settings.vue';
import EditorStage from './components/editor-stage.vue';
import FormatSettings from './components/format-settings.vue';
import OutputSizeSettings from './components/output-size-settings.vue';
import TransformSettings from './components/transform-settings.vue';
import type { CompressionMode, CropRatio, CropRect, ExportFormat } from './components/types';

const props = defineProps<{
  /** 原始文件名，用于页面展示和生成导出文件名。 */
  fileName: string;
  /** 图片的 MIME 类型，用于确定默认导出格式。 */
  mimeType: string;
  /** 编辑器读取图片内容的来源地址。 */
  sourceUrl: string;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
}>();

const editorStageRef = useTemplateRef<InstanceType<typeof EditorStage>>('editorStageRef');

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// 原图加载
const editorSourceUrl = ref('');
const sourceWidth = ref(0);
const sourceHeight = ref(0);
const isLoading = ref(true);
const errorMessage = ref('');
let sourceObjectUrl: string | null = null;

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

// 裁剪与输出尺寸
const cropRatio = ref<CropRatio>('free');
const crop = reactive<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
const outputWidth = ref(0);
const outputHeight = ref(0);
const lockRatio = ref(true);
const outputAspect = computed(() => crop.width / Math.max(crop.height, 1));

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

function handleCropUpdate(next: CropRect): void {
  crop.x = next.x;
  crop.y = next.y;
  crop.width = next.width;
  crop.height = next.height;
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

// 图片变换
const flipX = ref(false);
const flipY = ref(false);

function rotateImage(direction: 'left' | 'right'): void {
  void editorStageRef.value?.rotateImage(direction);
}

function toggleFlip(axis: 'x' | 'y'): void {
  if (!editorStageRef.value?.flipImage(axis)) return;
  if (axis === 'x') flipX.value = !flipX.value;
  if (axis === 'y') flipY.value = !flipY.value;
}

// 压缩与导出
interface EncodedImage {
  blob: Blob;
  height: number;
  quality: number | null;
  width: number;
}

const TARGET_MIN_QUALITY = 0.4;
const QUALITY_SEARCH_STEPS = 8;
const MAX_RESIZE_ATTEMPTS = 12;

const exportFormat = ref<ExportFormat>('png');
const compressionMode = ref<CompressionMode>('quality');
const quality = ref(90);
const targetSizeKb = ref(500);
const isExporting = ref(false);
const extension = computed(() => (exportFormat.value === 'jpeg' ? 'jpg' : exportFormat.value));
const outputMimeType = computed(() => `image/${exportFormat.value}`);

function updateQuality(value: number): void {
  quality.value = clamp(Math.round(value), 10, 100);
}

function updateTargetSize(value: number): void {
  targetSizeKb.value = clamp(Math.round(value), 10, 102_400);
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

// 在目标文件大小内寻找尽可能高的编码质量
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

// 质量仍无法达标时，按比例缩小输出像素尺寸
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

// 根据当前压缩模式创建最终导出文件
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

// 编辑器重置
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

    <section
      class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background text-card-foreground shadow-md transition-all hover:shadow-lg"
      aria-label="图片编辑设置"
    >
      <header class="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
        <h2 class="text-sm font-medium">编辑设置</h2>
        <Button size="sm" variant="ghost" @click="resetEditor">
          <RotateCcw class="size-3.5" />
          重置
        </Button>
      </header>

      <ScrollArea class="min-h-0 flex-1">
        <div class="space-y-6 px-5 py-5">
          <CropSettings
            :crop="crop"
            :crop-ratio="cropRatio"
            @crop-width-input="updateCropWidth"
            @crop-height-input="updateCropHeight"
            @update:crop-ratio="fitCropToRatio"
          />
          <TransformSettings
            :flip-x="flipX"
            :flip-y="flipY"
            @rotate="rotateImage"
            @flip="toggleFlip"
          />
          <OutputSizeSettings
            :crop="crop"
            :source-width="sourceWidth"
            :source-height="sourceHeight"
            :output-width="outputWidth"
            :output-height="outputHeight"
            :lock-ratio="lockRatio"
            @output-width-input="updateOutputWidth"
            @output-height-input="updateOutputHeight"
            @update:lock-ratio="lockRatio = $event"
          />
          <FormatSettings
            :export-format="exportFormat"
            @update:export-format="exportFormat = $event"
          />
          <CompressionSettings
            :compression-mode="compressionMode"
            :quality="quality"
            :target-size-kb="targetSizeKb"
            @update:compression-mode="compressionMode = $event"
            @quality-input="updateQuality"
            @target-size-input="updateTargetSize"
          />
        </div>
      </ScrollArea>

      <footer class="shrink-0 border-t bg-background px-5 py-4">
        <Button
          class="w-full"
          :disabled="isLoading || Boolean(errorMessage) || isExporting"
          @click="exportImage"
        >
          <Download class="size-4" />
          导出新图片
        </Button>
      </footer>
    </section>
  </div>
</template>
