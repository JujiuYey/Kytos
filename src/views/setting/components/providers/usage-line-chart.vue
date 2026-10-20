<script setup lang="ts">
// 近 30 天消费折线图：单条序列自绘 SVG 即可，不值得为此引入图表库
import { computed, ref } from 'vue';
import { useElementSize } from '@vueuse/core';
import type { ProviderUsageDay } from '@/types';

const props = defineProps<{
  // 逐日消费，按自然日升序，无消费的日子已补 0
  days: ProviderUsageDay[];
}>();

// 高度固定，宽度跟随容器；上下留白避免最高点与描边被裁掉，两端留白避免端点被裁掉
const CHART_HEIGHT = 88;
const PAD_X = 8;
const PAD_Y = 10;

const chartRef = ref<HTMLDivElement | null>(null);
const { width } = useElementSize(chartRef);

const points = computed(() => {
  const chartWidth = width.value;
  if (chartWidth <= 0 || props.days.length < 2) {
    return [];
  }
  const maxValue = Math.max(...props.days.map(day => day.credits));
  const stepX = (chartWidth - PAD_X * 2) / (props.days.length - 1);
  const baselineY = CHART_HEIGHT - PAD_Y;
  const usableHeight = CHART_HEIGHT - PAD_Y * 2;
  return props.days.map((day, index) => ({
    ...day,
    x: PAD_X + index * stepX,
    // 全 0 时把折线压在基线上，避免除零
    y: maxValue === 0 ? baselineY : baselineY - (day.credits / maxValue) * usableHeight,
  }));
});

const linePath = computed(() =>
  points.value.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' '),
);

const areaPath = computed(() => {
  const pts = points.value;
  if (pts.length === 0) {
    return '';
  }
  const baselineY = CHART_HEIGHT - PAD_Y;
  const last = pts[pts.length - 1];
  const first = pts[0];
  return `${linePath.value} L${last?.x ?? 0},${baselineY} L${first?.x ?? 0},${baselineY} Z`;
});

const hoveredIndex = ref<number | null>(null);
const hoveredPoint = computed(() => {
  if (hoveredIndex.value === null) {
    return null;
  }
  return points.value[hoveredIndex.value] ?? null;
});

function locateHover(event: MouseEvent): void {
  const pts = points.value;
  if (pts.length < 2) {
    return;
  }
  const rect = chartRef.value?.getBoundingClientRect();
  if (!rect) {
    return;
  }
  const stepX = (rect.width - PAD_X * 2) / (pts.length - 1);
  const index = Math.round((event.clientX - rect.left - PAD_X) / stepX);
  hoveredIndex.value = Math.min(Math.max(index, 0), pts.length - 1);
}

function formatDate(date: string): string {
  const [, month, day] = date.split('-');
  return month && day ? `${Number(month)}-${Number(day)}` : date;
}

function formatCredits(credits: number): string {
  return `${credits.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 积分`;
}
</script>

<template>
  <div
    ref="chartRef"
    class="relative h-[88px] w-full cursor-crosshair select-none"
    role="img"
    aria-label="近 30 天每日消费折线图"
    @mousemove="locateHover"
    @mouseleave="hoveredIndex = null"
  >
    <svg v-if="points.length > 0" :width="width" :height="CHART_HEIGHT" class="block text-primary">
      <defs>
        <linearGradient id="usage-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="currentColor" stop-opacity="0.16" />
          <stop offset="100%" stop-color="currentColor" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line
        :x1="PAD_X"
        :x2="width - PAD_X"
        :y1="CHART_HEIGHT - PAD_Y"
        :y2="CHART_HEIGHT - PAD_Y"
        class="stroke-border"
        stroke-dasharray="2 3"
      />
      <path :d="areaPath" fill="url(#usage-area)" />
      <path
        :d="linePath"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <g v-if="hoveredPoint">
        <line
          :x1="hoveredPoint.x"
          :x2="hoveredPoint.x"
          :y1="PAD_Y"
          :y2="CHART_HEIGHT - PAD_Y"
          class="stroke-border"
        />
        <circle :cx="hoveredPoint.x" :cy="hoveredPoint.y" r="3" fill="currentColor" />
      </g>
    </svg>
    <div
      v-if="hoveredPoint"
      class="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-md border border-border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-md"
      :style="{ left: `${hoveredPoint.x}px` }"
    >
      {{ formatDate(hoveredPoint.date) }} · {{ formatCredits(hoveredPoint.credits) }}
      <span v-if="hoveredPoint.requests > 0" class="text-muted-foreground">
        · {{ hoveredPoint.requests }} 次
      </span>
    </div>
  </div>
</template>
