<script setup lang="ts">
import { computed, useSlots } from 'vue';
import type { FlowEmits, FlowProps } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { VueFlow } from '@vue-flow/core';
import { useForwardPropsEmits } from 'reka-ui';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';

const props = withDefaults(defineProps<FlowProps>(), {
  deleteKeyCode: () => ['Backspace', 'Delete'],
  fitViewOnInit: true,
  panOnDrag: false,
  panOnScroll: true,
  selectNodesOnDrag: true,
  zoomOnDoubleClick: false,
});

const emits = defineEmits<FlowEmits>();
const slots = useSlots();
const forwarded = useForwardPropsEmits(props, emits);
const forwardedSlotNames = computed(() =>
  Object.keys(slots).filter(
    name => name !== 'default' && name !== 'connection-line' && name !== 'zoom-pane',
  ),
);
</script>

<template>
  <VueFlow data-slot="canvas" v-bind="forwarded">
    <Background />

    <template v-if="slots['connection-line']" #connection-line="connectionLineProps">
      <slot name="connection-line" v-bind="connectionLineProps" />
    </template>

    <template v-if="slots['zoom-pane']" #zoom-pane>
      <slot name="zoom-pane" />
    </template>

    <template v-for="name in forwardedSlotNames" :key="name" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>

    <slot />
  </VueFlow>
</template>
