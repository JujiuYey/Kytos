<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  shallowRef,
  watch,
} from 'vue';
import { toast } from 'vue-sonner';
import {
  Check,
  Crop,
  Download,
  FlipHorizontal,
  FlipVertical,
  LoaderCircle,
  ArrowLeft,
  RotateCcw,
  RotateCw,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ExportFileRequest } from '@/types';

const props = defineProps<{
  fileName: string;
  mimeType: string;
  sourceUrl: string;
}>();

const emit = defineEmits<{
  (event: 'back'): void;
}>();

type CropRatio = 'free' | '1:1' | '3:4' | '4:5' | '16:9';
type ExportFormat = 'jpeg' | 'png' | 'webp';
interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const canvas = ref<HTMLCanvasElement | null>(null);
const stageContainer = ref<HTMLElement | null>(null);
const stageScale = ref(1);
const sourceImage = shallowRef<HTMLImageElement | null>(null);
const sourceWidth = ref(0);
const sourceHeight = ref(0);
const isLoading = ref(true);
const errorMessage = ref('');
const isExporting = ref(false);
const mobilePane = ref<'preview' | 'settings'>('preview');
const cropRatio = ref<CropRatio>('free');
const rotation = ref(0);
const flipX = ref(false);
const flipY = ref(false);
const outputWidth = ref(0);
const outputHeight = ref(0);
const lockRatio = ref(true);
const exportFormat = ref<ExportFormat>('png');
const quality = ref(90);
const crop = reactive<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
const gesture = ref<'move' | 'resize' | null>(null);
const gestureStart = reactive({
  clientX: 0,
  clientY: 0,
  crop: { x: 0, y: 0, width: 0, height: 0 },
});
let resizeObserver: ResizeObserver | null = null;

const transformedSize = computed(() =>
  rotation.value % 180 === 0
    ? { width: sourceWidth.value, height: sourceHeight.value }
    : { width: sourceHeight.value, height: sourceWidth.value },
);
const stageStyle = computed(() => ({
  width: `${Math.max(1, transformedSize.value.width * stageScale.value)}px`,
  height: `${Math.max(1, transformedSize.value.height * stageScale.value)}px`,
}));
const cropStyle = computed(() => ({
  left: `${(crop.x / transformedSize.value.width) * 100}%`,
  top: `${(crop.y / transformedSize.value.height) * 100}%`,
  width: `${(crop.width / transformedSize.value.width) * 100}%`,
  height: `${(crop.height / transformedSize.value.height) * 100}%`,
}));
const currentSizeLabel = computed(
  () => `${Math.round(crop.width)} × ${Math.round(crop.height)} px`,
);
const originalSizeLabel = computed(() => `${sourceWidth.value} × ${sourceHeight.value} px`);
const outputAspect = computed(() => crop.width / Math.max(crop.height, 1));
const extension = computed(() => (exportFormat.value === 'jpeg' ? 'jpg' : exportFormat.value));
const outputMimeType = computed(() => `image/${exportFormat.value}`);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resetCrop(): void {
  crop.x = 0;
  crop.y = 0;
  crop.width = transformedSize.value.width;
  crop.height = transformedSize.value.height;
  syncOutputFromCrop();
}

function syncOutputFromCrop(): void {
  outputWidth.value = Math.max(1, Math.round(crop.width));
  outputHeight.value = Math.max(1, Math.round(crop.height));
}

function fitCropToRatio(nextRatio: CropRatio): void {
  cropRatio.value = nextRatio;
  if (nextRatio === 'free' || !transformedSize.value.width) {
    return;
  }
  const [width = 1, height = 1] = nextRatio.split(':').map(Number);
  const ratio = width / height;
  let nextWidth = crop.width;
  let nextHeight = nextWidth / ratio;
  if (nextHeight > transformedSize.value.height) {
    nextHeight = transformedSize.value.height;
    nextWidth = nextHeight * ratio;
  }
  if (nextWidth > transformedSize.value.width) {
    nextWidth = transformedSize.value.width;
    nextHeight = nextWidth / ratio;
  }
  crop.width = nextWidth;
  crop.height = nextHeight;
  crop.x = (transformedSize.value.width - nextWidth) / 2;
  crop.y = (transformedSize.value.height - nextHeight) / 2;
  syncOutputFromCrop();
}

function updateOutputWidth(value: string | number): void {
  const nextWidth = clamp(Math.round(Number(value) || 1), 1, 16_000);
  outputWidth.value = nextWidth;
  if (lockRatio.value) {
    outputHeight.value = clamp(
      Math.round(nextWidth / Math.max(outputAspect.value, 0.001)),
      1,
      16_000,
    );
  }
}

function updateOutputHeight(value: string | number): void {
  const nextHeight = clamp(Math.round(Number(value) || 1), 1, 16_000);
  outputHeight.value = nextHeight;
  if (lockRatio.value) {
    outputWidth.value = clamp(Math.round(nextHeight * outputAspect.value), 1, 16_000);
  }
}

function updateCropWidth(value: string | number): void {
  crop.width = clamp(Number(value) || 24, 24, transformedSize.value.width);
  crop.x = Math.min(crop.x, transformedSize.value.width - crop.width);
  syncOutputFromCrop();
}

function updateCropHeight(value: string | number): void {
  crop.height = clamp(Number(value) || 24, 24, transformedSize.value.height);
  crop.y = Math.min(crop.y, transformedSize.value.height - crop.height);
  syncOutputFromCrop();
}

function updateQuality(value: string | number): void {
  quality.value = clamp(Math.round(Number(value) || 90), 10, 100);
}

function rotateImage(direction: 'left' | 'right'): void {
  rotation.value = (rotation.value + (direction === 'right' ? 90 : 270)) % 360;
  resetCrop();
}

function toggleFlip(axis: 'x' | 'y'): void {
  if (axis === 'x') flipX.value = !flipX.value;
  if (axis === 'y') flipY.value = !flipY.value;
}

function getTransformedCanvas(): HTMLCanvasElement {
  const image = sourceImage.value;
  const output = document.createElement('canvas');
  output.width = transformedSize.value.width;
  output.height = transformedSize.value.height;
  const context = output.getContext('2d');
  if (!context || !image) return output;
  context.translate(output.width / 2, output.height / 2);
  context.scale(flipX.value ? -1 : 1, flipY.value ? -1 : 1);
  context.rotate((rotation.value * Math.PI) / 180);
  context.drawImage(image, -sourceWidth.value / 2, -sourceHeight.value / 2);
  return output;
}

function renderPreview(): void {
  const target = canvas.value;
  if (!target || !sourceImage.value) return;
  const rendered = getTransformedCanvas();
  target.width = rendered.width;
  target.height = rendered.height;
  target.getContext('2d')?.drawImage(rendered, 0, 0);
}

function updateStageScale(): void {
  const container = stageContainer.value;
  if (!container || !transformedSize.value.width) return;
  const rect = container.getBoundingClientRect();
  const widthScale = (rect.width - 32) / transformedSize.value.width;
  const heightScale = (rect.height - 32) / transformedSize.value.height;
  stageScale.value = Math.min(1, Math.max(0.05, Math.min(widthScale, heightScale)));
}

function beginGesture(event: PointerEvent, mode: 'move' | 'resize'): void {
  if (!transformedSize.value.width) return;
  gesture.value = mode;
  gestureStart.clientX = event.clientX;
  gestureStart.clientY = event.clientY;
  gestureStart.crop = { ...crop };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}

function updateGesture(event: PointerEvent): void {
  if (!gesture.value || !stageScale.value) return;
  const deltaX = (event.clientX - gestureStart.clientX) / stageScale.value;
  const deltaY = (event.clientY - gestureStart.clientY) / stageScale.value;
  if (gesture.value === 'move') {
    crop.x = clamp(gestureStart.crop.x + deltaX, 0, transformedSize.value.width - crop.width);
    crop.y = clamp(gestureStart.crop.y + deltaY, 0, transformedSize.value.height - crop.height);
    return;
  }
  const nextWidth = clamp(
    gestureStart.crop.width + deltaX,
    24,
    transformedSize.value.width - gestureStart.crop.x,
  );
  let nextHeight = clamp(
    gestureStart.crop.height + deltaY,
    24,
    transformedSize.value.height - gestureStart.crop.y,
  );
  let finalWidth = nextWidth;
  if (cropRatio.value !== 'free') {
    finalWidth = Math.min(nextWidth, nextHeight * outputAspect.value);
    nextHeight = finalWidth / outputAspect.value;
  }
  crop.width = Math.max(24, finalWidth);
  crop.height = Math.max(24, nextHeight);
  syncOutputFromCrop();
}

function endGesture(): void {
  gesture.value = null;
}

function resetEditor(): void {
  rotation.value = 0;
  flipX.value = false;
  flipY.value = false;
  cropRatio.value = 'free';
  resetCrop();
  quality.value = 90;
  exportFormat.value = 'png';
  toast.success('编辑已重置');
}

async function exportImage(): Promise<void> {
  if (!sourceImage.value || isExporting.value) return;
  isExporting.value = true;
  try {
    const rendered = getTransformedCanvas();
    const output = document.createElement('canvas');
    output.width = outputWidth.value;
    output.height = outputHeight.value;
    const context = output.getContext('2d');
    if (!context) throw new Error('无法创建图片画布');
    if (exportFormat.value === 'jpeg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, output.width, output.height);
    }
    context.drawImage(
      rendered,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      output.width,
      output.height,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      output.toBlob(
        result => (result ? resolve(result) : reject(new Error('图片导出失败'))),
        outputMimeType.value,
        quality.value / 100,
      );
    });
    const request: ExportFileRequest = {
      fileName: `${stripExtension(props.fileName)}-编辑.${extension.value}`,
      fileData: new Uint8Array(await blob.arrayBuffer()),
      mimeType: outputMimeType.value,
    };
    const result = await window.desktop.file.exportFile(request);
    if (!result.canceled) toast.success('图片已导出');
  } catch (error: unknown) {
    toast.error(error instanceof Error ? error.message : '图片导出失败');
  } finally {
    isExporting.value = false;
  }
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, '') || '未命名图片';
}

async function loadImage(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = '';
  try {
    const response = await fetch(props.sourceUrl);
    if (!response.ok) throw new Error('原图读取失败');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.src = url;
    await image.decode();
    sourceImage.value = image;
    sourceWidth.value = image.naturalWidth;
    sourceHeight.value = image.naturalHeight;
    exportFormat.value =
      props.mimeType === 'image/jpeg' ? 'jpeg' : props.mimeType === 'image/webp' ? 'webp' : 'png';
    resetCrop();
    await nextTick();
    updateStageScale();
    renderPreview();
    URL.revokeObjectURL(url);
  } catch (error: unknown) {
    errorMessage.value = error instanceof Error ? error.message : '原图读取失败';
  } finally {
    isLoading.value = false;
  }
}

watch([rotation, flipX, flipY], () => {
  renderPreview();
  updateStageScale();
});
watch([sourceWidth, sourceHeight], () => {
  renderPreview();
  updateStageScale();
});

onMounted(() => {
  void loadImage();
  resizeObserver = new ResizeObserver(updateStageScale);
  if (stageContainer.value) resizeObserver.observe(stageContainer.value);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
});
</script>

<template>
  <main class="flex h-full min-h-0 flex-col overflow-hidden bg-background">
    <header class="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 sm:px-5">
      <Button size="icon" variant="ghost" aria-label="返回" @click="emit('back')">
        <ArrowLeft class="size-4" />
      </Button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-sm font-semibold">编辑图片</h1>
        <p class="truncate text-xs text-muted-foreground">{{ props.fileName }}</p>
      </div>
      <Tabs v-model="mobilePane" class="lg:hidden" aria-label="编辑器视图">
        <TabsList>
          <TabsTrigger value="preview">预览</TabsTrigger>
          <TabsTrigger value="settings">设置</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button :disabled="isLoading || Boolean(errorMessage) || isExporting" @click="exportImage">
        <LoaderCircle v-if="isExporting" class="size-4 animate-spin" />
        <Download v-else class="size-4" />
        <span class="hidden sm:inline">{{ isExporting ? '导出中' : '导出图片' }}</span>
      </Button>
    </header>

    <div class="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_340px]">
      <section
        ref="stageContainer"
        :class="[
          'min-h-0 items-center justify-center bg-muted/30 p-4 sm:p-6',
          mobilePane === 'preview' ? 'flex' : 'hidden lg:flex',
        ]"
        aria-label="图片预览"
      >
        <div
          v-if="isLoading"
          class="flex flex-col items-center gap-3 text-sm text-muted-foreground"
        >
          <LoaderCircle class="size-6 animate-spin" />
          正在读取图片
        </div>
        <div v-else-if="errorMessage" class="max-w-sm text-center">
          <p class="text-sm font-medium">无法读取这张图片</p>
          <p class="mt-2 text-sm text-muted-foreground">{{ errorMessage }}</p>
          <Button class="mt-4" variant="outline" @click="emit('back')">返回</Button>
        </div>
        <div v-else class="relative shrink-0 shadow-sm" :style="stageStyle">
          <canvas
            ref="canvas"
            class="block size-full bg-[repeating-conic-gradient(#e5e7eb_0_25%,#f8fafc_0_50%)_50%/16px_16px]"
          />
          <div
            class="absolute cursor-move border-2 border-primary shadow-[0_0_0_9999px_rgb(0_0_0/0.52)]"
            :style="cropStyle"
            @pointerdown="event => beginGesture(event, 'move')"
            @pointermove="updateGesture"
            @pointerup="endGesture"
            @pointercancel="endGesture"
          >
            <div
              class="absolute bottom-[-5px] right-[-5px] size-3 cursor-se-resize rounded-sm border-2 border-primary bg-background"
              aria-hidden="true"
              @pointerdown.stop="event => beginGesture(event, 'resize')"
              @pointermove.stop="updateGesture"
              @pointerup.stop="endGesture"
              @pointercancel.stop="endGesture"
            />
          </div>
        </div>
      </section>

      <ScrollArea
        :class="[
          'min-h-0 border-l bg-background',
          mobilePane === 'settings' ? 'flex' : 'hidden lg:flex',
        ]"
      >
        <section class="space-y-6 p-4 sm:p-5" aria-label="图片编辑设置">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-sm font-semibold">编辑设置</h2>
              <p class="mt-1 text-xs text-muted-foreground">调整后导出为新文件</p>
            </div>
            <Button size="sm" variant="ghost" @click="resetEditor">
              <RotateCcw class="size-3.5" />
              重置
            </Button>
          </div>

          <div class="space-y-3">
            <div class="flex items-center gap-2 text-sm font-medium">
              <Crop class="size-4 text-muted-foreground" />
              裁剪
            </div>
            <div class="grid grid-cols-2 gap-2">
              <Label class="col-span-2 text-xs text-muted-foreground">裁剪比例</Label>
              <Select
                :model-value="cropRatio"
                @update:model-value="fitCropToRatio(String($event) as CropRatio)"
              >
                <SelectTrigger class="col-span-2" aria-label="裁剪比例">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">自由裁剪</SelectItem>
                  <SelectItem value="1:1">1 : 1</SelectItem>
                  <SelectItem value="3:4">3 : 4</SelectItem>
                  <SelectItem value="4:5">4 : 5</SelectItem>
                  <SelectItem value="16:9">16 : 9</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="grid grid-cols-2 gap-2 text-xs">
              <div class="space-y-1">
                <Label for="crop-width">宽度</Label>
                <Input
                  id="crop-width"
                  :model-value="Math.round(crop.width)"
                  type="number"
                  min="1"
                  @update:model-value="updateCropWidth"
                />
              </div>
              <div class="space-y-1">
                <Label for="crop-height">高度</Label>
                <Input
                  id="crop-height"
                  :model-value="Math.round(crop.height)"
                  type="number"
                  min="1"
                  @update:model-value="updateCropHeight"
                />
              </div>
            </div>
            <p class="text-xs text-muted-foreground">拖动裁剪框移动，右下角控制点调整范围。</p>
          </div>

          <div class="space-y-3 border-t pt-5">
            <div class="flex items-center gap-2 text-sm font-medium">变换</div>
            <div class="grid grid-cols-4 gap-2">
              <TooltipProvider :delay-duration="300">
                <Tooltip
                  ><TooltipTrigger as-child
                    ><Button
                      size="icon"
                      variant="outline"
                      aria-label="向左旋转"
                      @click="rotateImage('left')"
                      ><RotateCcw class="size-4" /></Button></TooltipTrigger
                  ><TooltipContent>向左旋转 90°</TooltipContent></Tooltip
                >
                <Tooltip
                  ><TooltipTrigger as-child
                    ><Button
                      size="icon"
                      variant="outline"
                      aria-label="向右旋转"
                      @click="rotateImage('right')"
                      ><RotateCw class="size-4" /></Button></TooltipTrigger
                  ><TooltipContent>向右旋转 90°</TooltipContent></Tooltip
                >
                <Tooltip
                  ><TooltipTrigger as-child
                    ><Button
                      size="icon"
                      :variant="flipX ? 'default' : 'outline'"
                      aria-label="水平翻转"
                      @click="toggleFlip('x')"
                      ><FlipHorizontal class="size-4" /></Button></TooltipTrigger
                  ><TooltipContent>水平翻转</TooltipContent></Tooltip
                >
                <Tooltip
                  ><TooltipTrigger as-child
                    ><Button
                      size="icon"
                      :variant="flipY ? 'default' : 'outline'"
                      aria-label="垂直翻转"
                      @click="toggleFlip('y')"
                      ><FlipVertical class="size-4" /></Button></TooltipTrigger
                  ><TooltipContent>垂直翻转</TooltipContent></Tooltip
                >
              </TooltipProvider>
            </div>
          </div>

          <div class="space-y-3 border-t pt-5">
            <div class="flex items-center justify-between">
              <div>
                <div class="text-sm font-medium">输出尺寸</div>
                <p class="mt-1 text-xs text-muted-foreground">
                  原图 {{ originalSizeLabel }} · 裁剪 {{ currentSizeLabel }}
                </p>
              </div>
              <Check v-if="lockRatio" class="size-4 text-primary" aria-label="保持比例" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <Label for="output-width">宽度</Label
                ><Input
                  id="output-width"
                  type="number"
                  min="1"
                  max="16000"
                  :model-value="outputWidth"
                  @update:model-value="updateOutputWidth"
                />
              </div>
              <div class="space-y-1">
                <Label for="output-height">高度</Label
                ><Input
                  id="output-height"
                  type="number"
                  min="1"
                  max="16000"
                  :model-value="outputHeight"
                  @update:model-value="updateOutputHeight"
                />
              </div>
            </div>
            <Button
              class="w-full"
              size="sm"
              :variant="lockRatio ? 'secondary' : 'outline'"
              @click="lockRatio = !lockRatio"
            >
              {{ lockRatio ? '已锁定比例' : '锁定比例' }}
            </Button>
          </div>

          <div class="space-y-3 border-t pt-5">
            <div class="text-sm font-medium">压缩与格式</div>
            <div class="space-y-1">
              <Label for="export-format">导出格式</Label
              ><Select v-model="exportFormat"
                ><SelectTrigger id="export-format"><SelectValue /></SelectTrigger
                ><SelectContent
                  ><SelectItem value="png">PNG · 保留透明</SelectItem
                  ><SelectItem value="jpeg">JPEG · 体积更小</SelectItem
                  ><SelectItem value="webp">WebP · 推荐</SelectItem></SelectContent
                ></Select
              >
            </div>
            <div class="space-y-1">
              <Label for="export-quality">质量（{{ quality }}%）</Label
              ><Input
                id="export-quality"
                :model-value="quality"
                type="number"
                min="10"
                max="100"
                @update:model-value="updateQuality"
              />
            </div>
            <p class="text-xs leading-5 text-muted-foreground">
              质量只影响 JPEG 和 WebP；PNG 会无损导出。
            </p>
          </div>

          <Button
            class="w-full"
            :disabled="isLoading || Boolean(errorMessage) || isExporting"
            @click="exportImage"
          >
            <Download class="size-4" />
            导出新图片
          </Button>
        </section>
      </ScrollArea>
    </div>
  </main>
</template>
