<script setup lang="ts">
import { computed, ref } from 'vue';
import { LoaderCircle } from '@lucide/vue';
import { type CropperInstance, useCropper } from 'vue-picture-cropper';
import 'cropperjs/dist/cropper.css';
import 'vue-picture-cropper/style.css';
import { Button } from '@/components/ui/button';
import type { CropRatio, CropRect } from './types';

interface RenderCanvasOptions {
  fillColor?: string;
  height: number;
  width: number;
}

const props = defineProps<{
  sourceUrl: string;
  cropRatio: CropRatio;
  isLoading: boolean;
  errorMessage: string;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
  (event: 'error', value: string): void;
  (event: 'update:crop', value: CropRect): void;
}>();

const cropperError = ref('');
const displayedError = computed(() => props.errorMessage || cropperError.value);

function getAspectRatio(cropRatio: CropRatio): number {
  if (cropRatio === 'free') return Number.NaN;
  const [width = 1, height = 1] = cropRatio.split(':').map(Number);
  return width / height;
}

function syncCropFromInstance(instance: CropperInstance | null = cropperApi.getInstance()): void {
  if (!instance) return;
  const { x, y, width, height } = instance.getData();
  emit('update:crop', { x, y, width, height });
}

function fitImageAndSelection(
  cropRatio: CropRatio = props.cropRatio,
  instance: CropperInstance | null = cropperApi.getInstance(),
): boolean {
  if (!instance) return false;

  const container = instance.getContainerData();
  const canvas = instance.getCanvasData();
  const scale = Math.min(
    container.width / canvas.naturalWidth,
    container.height / canvas.naturalHeight,
  );
  const width = canvas.naturalWidth * scale;
  const height = canvas.naturalHeight * scale;
  const cropBox = instance.getCropBoxData();
  const placeholderSize = Math.max(1, Math.min(24, cropBox.width, cropBox.height));

  // Shrink the crop box first so viewMode does not enlarge the image to cover it.
  instance.setCropBoxData({
    left: cropBox.left + (cropBox.width - placeholderSize) / 2,
    top: cropBox.top + (cropBox.height - placeholderSize) / 2,
    width: placeholderSize,
    height: placeholderSize,
  });
  instance.setCanvasData({
    left: (container.width - width) / 2,
    top: (container.height - height) / 2,
    width,
  });
  instance.setAspectRatio(getAspectRatio(cropRatio));
  syncCropFromInstance(instance);
  return true;
}

function handleCropperReady(instance: CropperInstance): void {
  cropperError.value = '';
  fitImageAndSelection(props.cropRatio, instance);
}

function handleCropperError(error: Error): void {
  cropperError.value = error.message || '图片裁剪器初始化失败';
  emit('error', cropperError.value);
}

const cropperOptions: CropperInstance.Options = {
  autoCropArea: 1,
  background: false,
  center: true,
  crop: event => {
    const { x, y, width, height } = event.detail;
    emit('update:crop', { x, y, width, height });
  },
  cropBoxMovable: true,
  cropBoxResizable: true,
  dragMode: 'none',
  guides: true,
  highlight: false,
  minCropBoxHeight: 24,
  minCropBoxWidth: 24,
  modal: true,
  movable: false,
  ready: event => handleCropperReady(event.currentTarget.cropper as CropperInstance),
  responsive: true,
  restore: true,
  rotatable: true,
  scalable: true,
  toggleDragModeOnDblclick: false,
  viewMode: 1,
  zoomOnTouch: false,
  zoomOnWheel: false,
  zoomable: false,
};

const cropperProps = computed(() => ({
  img: props.sourceUrl,
  boxStyle: {
    height: '100%',
    width: '100%',
  },
  options: cropperOptions,
}));
const [CropperComponent, cropperApi] = useCropper(cropperProps);

cropperApi.onInstanceEffect(instance => {
  const handleImageError = () => handleCropperError(new Error('图片裁剪器初始化失败'));
  instance.element.addEventListener('error', handleImageError);
  return () => instance.element.removeEventListener('error', handleImageError);
});

function setCropRatio(cropRatio: CropRatio): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  instance.setAspectRatio(getAspectRatio(cropRatio));
  syncCropFromInstance(instance);
  return true;
}

function setCropDimension(axis: 'height' | 'width', value: number): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;

  const current = instance.getData();
  const aspectRatio = getAspectRatio(props.cropRatio);
  let width = axis === 'width' ? Math.max(1, value) : current.width;
  let height = axis === 'height' ? Math.max(1, value) : current.height;
  if (Number.isFinite(aspectRatio)) {
    if (axis === 'width') height = width / aspectRatio;
    else width = height * aspectRatio;
  }

  instance.setData({
    x: current.x + (current.width - width) / 2,
    y: current.y + (current.height - height) / 2,
    width,
    height,
  });
  syncCropFromInstance(instance);
  return true;
}

function setCropWidth(value: number): boolean {
  return setCropDimension('width', value);
}

function setCropHeight(value: number): boolean {
  return setCropDimension('height', value);
}

function rotateImage(direction: 'left' | 'right'): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  instance.rotate(direction === 'right' ? 90 : -90);
  return fitImageAndSelection(props.cropRatio, instance);
}

function flipImage(axis: 'x' | 'y'): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  const data = instance.getData();
  if (axis === 'x') instance.scaleX(-data.scaleX);
  else instance.scaleY(-data.scaleY);
  syncCropFromInstance(instance);
  return true;
}

function resetEditor(cropRatio: CropRatio = 'free'): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  instance.reset();
  return fitImageAndSelection(cropRatio, instance);
}

async function renderCanvas(options: RenderCanvasOptions): Promise<HTMLCanvasElement | null> {
  const instance = cropperApi.getInstance();
  if (!instance) return null;

  try {
    return instance.getCroppedCanvas({
      width: Math.max(1, Math.round(options.width)),
      height: Math.max(1, Math.round(options.height)),
      fillColor: options.fillColor,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });
  } catch {
    return null;
  }
}

defineExpose({
  flipImage,
  renderCanvas,
  resetEditor,
  rotateImage,
  setCropHeight,
  setCropRatio,
  setCropWidth,
});
</script>

<template>
  <section
    class="editor-stage flex min-h-0 items-center justify-center overflow-hidden p-4 sm:p-6"
    aria-label="图片预览"
  >
    <div v-if="isLoading" class="flex flex-col items-center gap-3 text-sm text-muted-foreground">
      <LoaderCircle class="size-6 animate-spin" />
      正在读取图片
    </div>
    <div v-else-if="displayedError" class="max-w-sm text-center">
      <p class="text-sm font-medium">无法读取这张图片</p>
      <p class="mt-2 text-sm text-muted-foreground">{{ displayedError }}</p>
      <Button class="mt-4" variant="outline" @click="emit('back')">返回</Button>
    </div>
    <CropperComponent v-else-if="sourceUrl" class="size-full min-h-0" />
  </section>
</template>

<style scoped>
.editor-stage {
  background-color: var(--background);
  background-image:
    linear-gradient(
      to right,
      color-mix(in oklab, var(--border) 42%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in oklab, var(--border) 42%, transparent) 1px,
      transparent 1px
    );
  background-size: 24px 24px;
}

:deep(.vpc-root),
:deep(.cropper-container) {
  width: 100%;
  height: 100%;
  min-height: 0;
}

:deep(.cropper-modal) {
  background-color: color-mix(in oklab, var(--background) 86%, transparent);
  background-image:
    linear-gradient(
      to right,
      color-mix(in oklab, var(--border) 28%, transparent) 1px,
      transparent 1px
    ),
    linear-gradient(
      to bottom,
      color-mix(in oklab, var(--border) 28%, transparent) 1px,
      transparent 1px
    );
  background-size: 24px 24px;
  opacity: 1;
}

:deep(.cropper-crop-box) {
  filter: drop-shadow(0 12px 22px color-mix(in oklab, var(--foreground) 16%, transparent));
}

:deep(.cropper-view-box) {
  outline-color: color-mix(in oklab, var(--primary) 72%, transparent);
}

:deep(.cropper-line),
:deep(.cropper-point) {
  background-color: var(--primary);
}
</style>
