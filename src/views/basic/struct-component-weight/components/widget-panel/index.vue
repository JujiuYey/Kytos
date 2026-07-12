<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Widget, WidgetType } from '../../types';
import { structSections } from '../../mock-data/index';

const props = defineProps<{
  /**
   * 选中的桥梁类型
   */
  selectedType: string;
  /**
   * 桥梁类型列表
   */
  bridgeList: Array<{ id: string; name: string }>;
  /**
   * 构件列表
   */
  widgetList: Widget[];
}>();

// 过滤出指定类型的构件
const getWidgetsByType = computed(() => (type: WidgetType) => {
  return props.widgetList
    .filter(widget => widget.type === type)
    .sort((a, b) => a.sequence - b.sequence);
});
</script>

<template>
  <div class="flex-1 p-6 overflow-auto">
    <div class="mb-6 ">
      <h2 class=" mb-6 text-2xl font-bold tracking-tight">
        {{ bridgeList.find(t => t.id === selectedType)?.name || '请选择桥梁类型' }}
      </h2>
    </div>

    <div v-if="selectedType" class="space-y-8">
      <template v-for="section of structSections" :key="section.key">
        <div class="space-y-4">
          <h3 class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <component :is="section.icon" class="h-5 w-5 text-primary" />
              <span class="text-xl font-semibold">
                {{ section.title }}（{{ getWidgetsByType(section.key as WidgetType).length }}）
              </span>
            </div>
          </h3>
          <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <Card
              v-for="widget of getWidgetsByType(section.key as WidgetType)"
              :key="widget.id"
              class="cursor-pointer hover:shadow-md transition-shadow group h-full flex flex-col p-2"
            >
              <CardHeader>
                <CardTitle class="text-base line-clamp-2 h-10 flex items-center">
                  {{ widget.name }}
                </CardTitle>
              </CardHeader>
              <CardContent class="text-sm text-muted-foreground">
                <div class="flex justify-between items-center">
                  <span>权重: {{ widget.weight }}</span>
                  <span class="text-xs text-muted-foreground/70">
                    序号: {{ widget.sequence }}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </template>
    </div>

    <div v-else class="flex items-center justify-center h-64 text-muted-foreground">
      <p>请从左侧选择桥梁类型</p>
    </div>
  </div>
</template>
