<script setup lang="ts">
import type { DateValue } from '@internationalized/date';
import { DateFormatter, getLocalTimeZone, parseDate } from '@internationalized/date';
import { Calendar as CalendarIcon } from 'lucide-vue-next';

import { computed } from 'vue';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface Props {
  modelValue?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | undefined): void;
}>();

const df = new DateFormatter('zh-CN', {
  dateStyle: 'long',
});

// 将字符串转换为 DateValue，或将 DateValue 转换为字符串
const value = computed({
  get: (): DateValue | undefined => {
    if (!props.modelValue) {
      return undefined;
    }
    try {
      return parseDate(props.modelValue);
    } catch {
      return undefined;
    }
  },
  set: (val: DateValue | undefined) => {
    if (!val) {
      emit('update:modelValue', undefined);
      return;
    }
    // 转换为 YYYY-MM-DD 格式
    const dateStr = `${val.year}-${String(val.month).padStart(2, '0')}-${String(val.day).padStart(2, '0')}`;
    emit('update:modelValue', dateStr);
  },
});
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        :class="cn(
          'justify-start text-left font-normal',
          !value && 'text-muted-foreground',
        )"
      >
        <CalendarIcon class="mr-2 h-4 w-4" />
        {{ value ? df.format(value.toDate(getLocalTimeZone())) : "请选择日期" }}
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-auto p-0">
      <Calendar v-model="value" locale="zh-CN" initial-focus />
    </PopoverContent>
  </Popover>
</template>
