<script setup lang="ts">
import { computed } from 'vue';
import {
  Crop,
  Download,
  FlipHorizontal,
  FlipVertical,
  Lock,
  LockOpen,
  RotateCcw,
  RotateCw,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { CompressionMode, CropRatio, CropRect, ExportFormat } from './types';

const props = defineProps<{
  crop: CropRect;
  cropRatio: CropRatio;
  flipX: boolean;
  flipY: boolean;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  lockRatio: boolean;
  exportFormat: ExportFormat;
  compressionMode: CompressionMode;
  quality: number;
  targetSizeKb: number;
  isLoading: boolean;
  hasError: boolean;
  isExporting: boolean;
}>();

const emit = defineEmits<{
  (event: 'reset'): void;
  (event: 'export'): void;
  (event: 'rotate', direction: 'left' | 'right'): void;
  (event: 'flip', axis: 'x' | 'y'): void;
  (event: 'cropWidthInput', value: number): void;
  (event: 'cropHeightInput', value: number): void;
  (event: 'update:cropRatio', value: CropRatio): void;
  (event: 'outputWidthInput', value: number): void;
  (event: 'outputHeightInput', value: number): void;
  (event: 'update:lockRatio', value: boolean): void;
  (event: 'update:exportFormat', value: ExportFormat): void;
  (event: 'update:compressionMode', value: CompressionMode): void;
  (event: 'qualityInput', value: number): void;
  (event: 'targetSizeInput', value: number): void;
}>();

const currentSizeLabel = computed(
  () => `${Math.round(props.crop.width)} × ${Math.round(props.crop.height)} px`,
);
const originalSizeLabel = computed(() => `${props.sourceWidth} × ${props.sourceHeight} px`);
</script>

<template>
  <section
    class="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-background text-card-foreground shadow-md transition-all hover:shadow-lg"
    aria-label="图片编辑设置"
  >
    <header class="flex h-12 shrink-0 items-center justify-between border-b bg-background px-4">
      <h2 class="text-sm font-medium">编辑设置</h2>
      <Button size="sm" variant="ghost" @click="emit('reset')">
        <RotateCcw class="size-3.5" />
        重置
      </Button>
    </header>

    <ScrollArea class="min-h-0 flex-1">
      <div class="space-y-6 px-5 py-5">
        <div class="space-y-3">
          <div class="flex items-center gap-2 text-sm font-medium">
            <Crop class="size-4 text-muted-foreground" />
            裁剪
          </div>
          <div class="grid grid-cols-2 gap-2">
            <Label class="col-span-2 text-xs text-muted-foreground">裁剪比例</Label>
            <Select
              :model-value="cropRatio"
              @update:model-value="emit('update:cropRatio', $event as CropRatio)"
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
                @update:model-value="emit('cropWidthInput', Number($event))"
              />
            </div>
            <div class="space-y-1">
              <Label for="crop-height">高度</Label>
              <Input
                id="crop-height"
                :model-value="Math.round(crop.height)"
                type="number"
                min="1"
                @update:model-value="emit('cropHeightInput', Number($event))"
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
                    @click="emit('rotate', 'left')"
                    ><RotateCcw class="size-4" /></Button></TooltipTrigger
                ><TooltipContent>向左旋转 90°</TooltipContent></Tooltip
              >
              <Tooltip
                ><TooltipTrigger as-child
                  ><Button
                    size="icon"
                    variant="outline"
                    aria-label="向右旋转"
                    @click="emit('rotate', 'right')"
                    ><RotateCw class="size-4" /></Button></TooltipTrigger
                ><TooltipContent>向右旋转 90°</TooltipContent></Tooltip
              >
              <Tooltip
                ><TooltipTrigger as-child
                  ><Button
                    size="icon"
                    :variant="flipX ? 'default' : 'outline'"
                    aria-label="水平翻转"
                    @click="emit('flip', 'x')"
                    ><FlipHorizontal class="size-4" /></Button></TooltipTrigger
                ><TooltipContent>水平翻转</TooltipContent></Tooltip
              >
              <Tooltip
                ><TooltipTrigger as-child
                  ><Button
                    size="icon"
                    :variant="flipY ? 'default' : 'outline'"
                    aria-label="垂直翻转"
                    @click="emit('flip', 'y')"
                    ><FlipVertical class="size-4" /></Button></TooltipTrigger
                ><TooltipContent>垂直翻转</TooltipContent></Tooltip
              >
            </TooltipProvider>
          </div>
        </div>

        <div class="space-y-3 border-t pt-5">
          <div>
            <div class="text-sm font-medium">输出尺寸</div>
            <p class="mt-1 text-xs text-muted-foreground">
              原图 {{ originalSizeLabel }} · 裁剪 {{ currentSizeLabel }}
            </p>
          </div>
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] items-end gap-2">
            <div class="space-y-1">
              <Label for="output-width">宽度</Label
              ><Input
                id="output-width"
                type="number"
                min="1"
                max="16000"
                :model-value="outputWidth"
                @update:model-value="emit('outputWidthInput', Number($event))"
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
                @update:model-value="emit('outputHeightInput', Number($event))"
              />
            </div>
            <TooltipProvider :delay-duration="300">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    class="size-9"
                    size="icon"
                    :variant="lockRatio ? 'secondary' : 'outline'"
                    :aria-label="lockRatio ? '解除宽高比例锁定' : '锁定宽高比例'"
                    @click="emit('update:lockRatio', !lockRatio)"
                  >
                    <Lock v-if="lockRatio" class="size-4" />
                    <LockOpen v-else class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {{ lockRatio ? '解除宽高比例锁定' : '锁定宽高比例' }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <div class="space-y-3 border-t pt-5">
          <div class="text-sm font-medium">格式</div>
          <div class="space-y-1">
            <Label for="export-format">导出格式</Label
            ><Select
              :model-value="exportFormat"
              @update:model-value="emit('update:exportFormat', $event as ExportFormat)"
              ><SelectTrigger id="export-format"><SelectValue /></SelectTrigger
              ><SelectContent
                ><SelectItem value="png">PNG · 无损导出</SelectItem
                ><SelectItem value="jpeg">JPEG · 体积更小</SelectItem
                ><SelectItem value="webp">WebP · 推荐</SelectItem></SelectContent
              ></Select
            >
          </div>
        </div>

        <div class="space-y-3 border-t pt-5">
          <div class="text-sm font-medium">压缩</div>
          <Tabs
            :model-value="compressionMode"
            @update:model-value="emit('update:compressionMode', $event as CompressionMode)"
          >
            <TabsList class="w-full">
              <TabsTrigger value="quality">按质量</TabsTrigger>
              <TabsTrigger value="target-size">限制大小</TabsTrigger>
            </TabsList>

            <TabsContent value="quality" class="mt-1 space-y-3">
              <div class="space-y-1">
                <Label for="export-quality">质量（{{ quality }}%）</Label>
                <Input
                  id="export-quality"
                  :model-value="quality"
                  type="number"
                  min="10"
                  max="100"
                  @update:model-value="emit('qualityInput', Number($event))"
                />
              </div>
              <p class="text-xs leading-5 text-muted-foreground">
                质量只影响 JPEG 和 WebP；PNG 会无损导出。
              </p>
            </TabsContent>

            <TabsContent value="target-size" class="mt-1 space-y-3">
              <div class="space-y-1">
                <Label for="target-file-size">最大文件大小</Label>
                <InputGroup>
                  <InputGroupInput
                    id="target-file-size"
                    :model-value="targetSizeKb"
                    type="number"
                    min="10"
                    max="102400"
                    @update:model-value="emit('targetSizeInput', Number($event))"
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>KB</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </div>
              <p class="text-xs leading-5 text-muted-foreground">
                JPEG 和 WebP 会先自动调整质量，仍超出目标时等比例缩小尺寸；PNG 仅缩小尺寸。
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ScrollArea>

    <footer class="shrink-0 border-t bg-background px-5 py-4">
      <Button
        class="w-full"
        :disabled="isLoading || hasError || isExporting"
        @click="emit('export')"
      >
        <Download class="size-4" />
        导出新图片
      </Button>
    </footer>
  </section>
</template>
