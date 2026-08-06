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

// 裁剪器状态
const cropperError = ref('');
// 页面错误优先显示，裁剪器错误作为组件内部兜底。
const displayedError = computed(() => props.errorMessage || cropperError.value);

// 把比例选项转换成 Cropper 使用的数值比例。
function getAspectRatio(cropRatio: CropRatio): number {
  // Cropper 使用 NaN 表示不限制裁剪比例。
  if (cropRatio === 'free') return Number.NaN;
  const [width = 1, height = 1] = cropRatio.split(':').map(Number);
  return width / height;
}

// 将裁剪器当前选区同步给页面，供尺寸和导出逻辑使用。
function syncCropFromInstance(instance: CropperInstance | null = cropperApi.getInstance()): void {
  if (!instance) return;
  const { x, y, width, height } = instance.getData();
  emit('update:crop', { x, y, width, height });
}

// 初始化或变换后，让原图完整居中并重建裁剪选区。
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

  // 先缩小裁剪框，避免 viewMode 为覆盖旧裁剪框而把原图自动放大。
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

// 裁剪器准备完成后清除旧错误并应用当前比例。
function handleCropperReady(instance: CropperInstance): void {
  cropperError.value = '';
  fitImageAndSelection(props.cropRatio, instance);
}

// 将底层裁剪器错误转成页面可以展示的错误状态。
function handleCropperError(error: Error): void {
  cropperError.value = error.message || '图片裁剪器初始化失败';
  emit('error', cropperError.value);
}

// 裁剪器只允许操作选区，原图的缩放和位移由编辑器方法统一控制。
const cropperOptions: CropperInstance.Options = {
  autoCropArea: 1,
  background: false,
  center: true,
  crop: event => {
    // 拖动或调整选区时，持续同步裁剪坐标。
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
  // 裁剪器初始化后执行一次完整的画布和选区适配。
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

// 将响应式图片地址和容器尺寸传给裁剪器组件。
const cropperProps = computed(() => ({
  img: props.sourceUrl,
  boxStyle: {
    height: '100%',
    width: '100%',
  },
  options: cropperOptions,
}));
const [CropperComponent, cropperApi] = useCropper(cropperProps);

// 组件库不会把底层图片元素的加载失败自动映射成页面错误。
cropperApi.onInstanceEffect(instance => {
  // 监听底层图片元素，补充组件库没有转发的加载错误。
  const handleImageError = () => handleCropperError(new Error('图片裁剪器初始化失败'));
  instance.element.addEventListener('error', handleImageError);
  return () => instance.element.removeEventListener('error', handleImageError);
});

// 切换裁剪比例并同步新的选区数据。
function setCropRatio(cropRatio: CropRatio): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  instance.setAspectRatio(getAspectRatio(cropRatio));
  syncCropFromInstance(instance);
  return true;
}

// 修改单个裁剪尺寸；锁定比例时自动计算另一个尺寸。
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

  // 尺寸变化后保持选区中心不动，减少手动输入时的画面跳动。
  instance.setData({
    x: current.x + (current.width - width) / 2,
    y: current.y + (current.height - height) / 2,
    width,
    height,
  });
  syncCropFromInstance(instance);
  return true;
}

// 修改裁剪宽度的公开入口。
function setCropWidth(value: number): boolean {
  return setCropDimension('width', value);
}

// 修改裁剪高度的公开入口。
function setCropHeight(value: number): boolean {
  return setCropDimension('height', value);
}

// 图片变换后重新适配画布，确保旋转后的原图仍完整显示。
function rotateImage(direction: 'left' | 'right'): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  instance.rotate(direction === 'right' ? 90 : -90);
  return fitImageAndSelection(props.cropRatio, instance);
}

// 取反指定轴的缩放值实现镜像，再同步裁剪选区。
function flipImage(axis: 'x' | 'y'): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  const data = instance.getData();
  if (axis === 'x') instance.scaleX(-data.scaleX);
  else instance.scaleY(-data.scaleY);
  syncCropFromInstance(instance);
  return true;
}

// 恢复 Cropper 默认状态，并重新应用指定比例。
function resetEditor(cropRatio: CropRatio = 'free'): boolean {
  const instance = cropperApi.getInstance();
  if (!instance) return false;
  instance.reset();
  return fitImageAndSelection(cropRatio, instance);
}

// 导出阶段只负责生成画布，文件编码与保存由页面层处理。
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
  --editor-crop-accent: oklch(0.58 0.21 255);
  --editor-crop-handle: oklch(0.99 0 0);
  --editor-crop-handle-shadow: oklch(0 0 0 / 0.36);

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

:global(.dark) .editor-stage {
  --editor-crop-accent: oklch(0.72 0.16 250);
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
  outline: 2px solid var(--editor-crop-accent);
  outline-offset: -1px;
}

:deep(.cropper-line) {
  background-color: var(--editor-crop-accent);
  opacity: 0.35;
}

:deep(.cropper-point) {
  background-color: var(--editor-crop-handle);
  box-shadow: 0 1px 4px var(--editor-crop-handle-shadow);
  opacity: 1;
}

:deep(.cropper-point.point-n),
:deep(.cropper-point.point-s) {
  width: 28px;
  height: 6px;
  margin-left: -14px;
  border-radius: 9999px;
}

:deep(.cropper-point.point-e),
:deep(.cropper-point.point-w) {
  width: 6px;
  height: 28px;
  margin-top: -14px;
  border-radius: 9999px;
}

:deep(.cropper-point.point-nw),
:deep(.cropper-point.point-ne),
:deep(.cropper-point.point-sw),
:deep(.cropper-point.point-se) {
  width: 22px;
  height: 22px;
  background-color: transparent;
  box-shadow: none;
  filter: drop-shadow(0 1px 2px var(--editor-crop-handle-shadow));
}

:deep(.cropper-point.point-nw) {
  top: -2px;
  left: -2px;
  border-top: 6px solid var(--editor-crop-handle);
  border-left: 6px solid var(--editor-crop-handle);
  border-radius: 3px 0 0;
}

:deep(.cropper-point.point-ne) {
  top: -2px;
  right: -2px;
  border-top: 6px solid var(--editor-crop-handle);
  border-right: 6px solid var(--editor-crop-handle);
  border-radius: 0 3px 0 0;
}

:deep(.cropper-point.point-sw) {
  bottom: -2px;
  left: -2px;
  border-bottom: 6px solid var(--editor-crop-handle);
  border-left: 6px solid var(--editor-crop-handle);
  border-radius: 0 0 0 3px;
}

:deep(.cropper-point.point-se) {
  right: -2px;
  bottom: -2px;
  border-right: 6px solid var(--editor-crop-handle);
  border-bottom: 6px solid var(--editor-crop-handle);
  border-radius: 0 0 3px;
}

:deep(.cropper-point.point-se::before) {
  display: none;
}

:deep(.cropper-dashed) {
  border-color: color-mix(in oklab, var(--editor-crop-accent) 48%, transparent);
  opacity: 0.7;
}
</style>
