<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { ImageOff, LoaderCircle, Maximize2, Minus, Plus } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const props = withDefaults(
  defineProps<{
    alt?: string;
    description?: string;
    src: string;
    title?: string;
  }>(),
  {
    alt: '',
    description: '查看图片大图，可缩放和拖拽',
    title: '图片预览',
  },
);

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const SCALE_STEP = 0.25;

const viewport = ref<HTMLElement | null>(null);
const scale = ref(1);
const panX = ref(0);
const panY = ref(0);
const activePointerId = ref<number | null>(null);
const pointerStartX = ref(0);
const pointerStartY = ref(0);
const panStartX = ref(0);
const panStartY = ref(0);
const isLoaded = ref(false);
const hasError = ref(false);

const isDragging = computed(() => activePointerId.value !== null);
const scaleLabel = computed(() => `${Math.round(scale.value * 100)}%`);
const imageStyle = computed(() => ({
  transform: `translate3d(${panX.value}px, ${panY.value}px, 0) scale(${scale.value})`,
}));

function resetView() {
  scale.value = 1;
  panX.value = 0;
  panY.value = 0;
}

function setScale(nextScale: number, focalPoint?: { x: number; y: number }) {
  const clampedScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
  if (clampedScale === scale.value) {
    return;
  }

  if (focalPoint && viewport.value && clampedScale > 1) {
    const rect = viewport.value.getBoundingClientRect();
    const pointerX = focalPoint.x - rect.left - rect.width / 2;
    const pointerY = focalPoint.y - rect.top - rect.height / 2;
    const ratio = clampedScale / scale.value;
    panX.value = pointerX - (pointerX - panX.value) * ratio;
    panY.value = pointerY - (pointerY - panY.value) * ratio;
  } else if (clampedScale <= 1) {
    panX.value = 0;
    panY.value = 0;
  }

  scale.value = clampedScale;
}

function zoomIn() {
  setScale(scale.value + SCALE_STEP);
}

function zoomOut() {
  setScale(scale.value - SCALE_STEP);
}

function handleOpenChange(open: boolean) {
  if (!open) {
    activePointerId.value = null;
    resetView();
    return;
  }

  void nextTick(() => viewport.value?.focus());
}

function handleWheel(event: WheelEvent) {
  const direction = event.deltaY > 0 ? -1 : 1;
  setScale(scale.value + direction * SCALE_STEP, { x: event.clientX, y: event.clientY });
}

function handleDoubleClick(event: MouseEvent) {
  if (scale.value > 1) {
    resetView();
    return;
  }

  setScale(2, { x: event.clientX, y: event.clientY });
}

function handlePointerDown(event: PointerEvent) {
  if (scale.value <= 1 || event.button !== 0) {
    return;
  }

  activePointerId.value = event.pointerId;
  pointerStartX.value = event.clientX;
  pointerStartY.value = event.clientY;
  panStartX.value = panX.value;
  panStartY.value = panY.value;
  viewport.value?.setPointerCapture(event.pointerId);
}

function handlePointerMove(event: PointerEvent) {
  if (activePointerId.value !== event.pointerId) {
    return;
  }

  panX.value = panStartX.value + event.clientX - pointerStartX.value;
  panY.value = panStartY.value + event.clientY - pointerStartY.value;
}

function handlePointerUp(event: PointerEvent) {
  if (activePointerId.value !== event.pointerId) {
    return;
  }

  viewport.value?.releasePointerCapture(event.pointerId);
  activePointerId.value = null;
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === '+' || event.key === '=') {
    event.preventDefault();
    zoomIn();
  } else if (event.key === '-') {
    event.preventDefault();
    zoomOut();
  } else if (event.key === '0') {
    event.preventDefault();
    resetView();
  }
}

function handleImageLoad() {
  isLoaded.value = true;
  hasError.value = false;
}

function handleImageError() {
  isLoaded.value = false;
  hasError.value = true;
}

watch(
  () => props.src,
  () => {
    isLoaded.value = false;
    hasError.value = false;
    resetView();
  },
);
</script>

<template>
  <Dialog @update:open="handleOpenChange">
    <DialogTrigger as-child>
      <slot />
    </DialogTrigger>

    <DialogContent
      overlay-class="bg-black/55 backdrop-blur-[2px]"
      class="flex h-[90vh] max-h-[56rem] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border border-white/10 bg-black/45 p-0 text-white shadow-2xl backdrop-blur-md sm:max-w-6xl [&>[data-slot=dialog-close]]:rounded-md [&>[data-slot=dialog-close]]:bg-white/10 [&>[data-slot=dialog-close]]:p-2 [&>[data-slot=dialog-close]]:text-white [&>[data-slot=dialog-close]]:opacity-100 [&>[data-slot=dialog-close]]:hover:bg-white/20"
    >
      <DialogHeader class="sr-only">
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <div
        ref="viewport"
        tabindex="0"
        class="relative flex min-h-0 flex-1 touch-none select-none items-center justify-center overflow-hidden p-12 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        :class="scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in'"
        aria-label="图片缩放区域"
        @dblclick="handleDoubleClick"
        @keydown="handleKeydown"
        @pointercancel="handlePointerUp"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @wheel.prevent="handleWheel"
      >
        <LoaderCircle v-if="!isLoaded && !hasError" class="size-6 animate-spin opacity-70" />
        <div v-else-if="hasError" class="flex flex-col items-center gap-2 text-sm opacity-70">
          <ImageOff class="size-6" />
          <span>图片加载失败</span>
        </div>
        <img
          v-show="isLoaded"
          :alt="alt"
          :src="src"
          :style="imageStyle"
          class="max-h-full max-w-full object-contain transition-transform duration-150 ease-out"
          :class="isDragging && 'transition-none'"
          draggable="false"
          @error="handleImageError"
          @load="handleImageLoad"
        />

        <TooltipProvider :delay-duration="300">
          <div
            class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2"
            @dblclick.stop
            @pointerdown.stop
            @wheel.stop
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 border border-white/20 bg-black/35 text-white shadow-md backdrop-blur-sm hover:bg-black/50 hover:text-white"
                  :disabled="scale <= MIN_SCALE"
                  aria-label="缩小图片"
                  @click="zoomOut"
                >
                  <Minus class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>缩小</TooltipContent>
            </Tooltip>

            <span
              class="inline-flex h-8 min-w-14 items-center justify-center rounded-md border border-white/20 bg-black/35 px-2 text-xs text-white tabular-nums shadow-md backdrop-blur-sm"
            >
              {{ scaleLabel }}
            </span>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 border border-white/20 bg-black/35 text-white shadow-md backdrop-blur-sm hover:bg-black/50 hover:text-white"
                  :disabled="scale >= MAX_SCALE"
                  aria-label="放大图片"
                  @click="zoomIn"
                >
                  <Plus class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>放大</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger as-child>
                <Button
                  size="icon"
                  variant="ghost"
                  class="size-8 border border-white/20 bg-black/35 text-white shadow-md backdrop-blur-sm hover:bg-black/50 hover:text-white"
                  :disabled="scale === 1 && panX === 0 && panY === 0"
                  aria-label="恢复适合窗口大小"
                  @click="resetView"
                >
                  <Maximize2 class="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>适合窗口</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>
    </DialogContent>
  </Dialog>
</template>
