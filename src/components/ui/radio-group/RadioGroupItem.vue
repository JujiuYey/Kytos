<script setup lang="ts">
import type { RadioGroupItemProps } from 'reka-ui';
import type { HTMLAttributes } from 'vue';
import { reactiveOmit } from '@vueuse/core';
import { Circle } from '@lucide/vue';
import { RadioGroupIndicator, RadioGroupItem, useForwardPropsEmits } from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<RadioGroupItemProps & { class?: HTMLAttributes['class'] }>();

const delegatedProps = reactiveOmit(props, 'class');

const forwarded = useForwardPropsEmits(delegatedProps);
</script>

<template>
  <RadioGroupItem
    data-slot="radio-group-item"
    v-bind="forwarded"
    :class="
      cn(
        'aspect-square size-4 shrink-0 rounded-full border border-primary text-primary shadow-xs transition-shadow outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
  >
    <RadioGroupIndicator
      data-slot="radio-group-indicator"
      class="flex items-center justify-center text-current transition-none"
    >
      <Circle class="size-2.5 fill-current" />
    </RadioGroupIndicator>
  </RadioGroupItem>
</template>
