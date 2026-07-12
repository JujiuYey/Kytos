<script setup lang="ts">
import type { Widget, WidgetType } from '../../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-vue-next';

const props = defineProps<{
  widgets: Widget[];
  selectedWidget: Widget | null;
}>();

const emit = defineEmits<{
  (e: 'select', widget: Widget): void;
}>();

// 构件类型映射
const WIDGET_TYPE_MAP: Record<WidgetType, string> = {
  upper: '上部结构',
  lower: '下部结构',
  deck: '桥面系',
};

// 按类型分组构件
const groupedWidgets = computed(() => {
  return props.widgets.reduce((acc, widget) => {
    const type = widget.type || 'other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(widget);
    return acc;
  }, {} as Record<string, Widget[]>);
});

// 处理构件选择
function handleSelectWidget(widget: Widget) {
  emit('select', widget);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="mb-4">
      <h3 class="text-lg font-semibold text-foreground">
        构件列表
      </h3>
    </div>
    <div class="flex-1 overflow-hidden">
      <ScrollArea class="h-full pr-2">
        <div class="space-y-4">
          <Collapsible
            v-for="[type, items] of Object.entries(groupedWidgets)"
            :key="type"
            :default-open="true"
            class="space-y-2"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <h4 class="text-base font-medium">
                  {{ WIDGET_TYPE_MAP[type as WidgetType] || type }}
                </h4>
                <Badge variant="secondary" class="ml-2">
                  {{ items.length }}
                </Badge>
              </div>
              <CollapsibleTrigger as-child>
                <Button variant="ghost" size="sm" class="h-8 w-8 p-0">
                  <ChevronDown class="h-4 w-4" />
                  <span class="sr-only">Toggle</span>
                </Button>
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent class="space-y-2">
              <div
                v-for="widgetItem of items"
                :key="widgetItem.id"
                class="p-3 rounded-md border cursor-pointer transition-all hover:border-primary/50"
                :class="{
                  'border-primary bg-primary/5': selectedWidget?.id === widgetItem.id,
                  'border-border': selectedWidget?.id !== widgetItem.id,
                }"
                @click="handleSelectWidget(widgetItem)"
              >
                <div class="flex justify-between items-center">
                  <div class="font-medium text-foreground">
                    {{ widgetItem.name }}
                  </div>
                </div>
                <div class="text-sm text-muted-foreground mt-1">
                  构件编号: {{ widgetItem.id }}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>
