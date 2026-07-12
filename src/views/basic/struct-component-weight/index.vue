<script setup lang="ts">
import { ref } from 'vue';
import WidgetPanel from './components/widget-panel/index.vue';
import BridgeTypeList from './components/bridge-type-list/index.vue';
import { bridgeTypes, bridgeWidgets } from './mock-data';

const currentBridgeType = ref('beam-bridge');

/**
 * 处理桥梁类型选择
 * @param typeId
 */
function selectBridgeType(typeId: string) {
  currentBridgeType.value = typeId;
}

const widgetList = computed(() => {
  return bridgeWidgets.filter(widget => widget.bridgeTypeId === currentBridgeType.value);
});
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 左侧桥梁类型列表 -->
    <BridgeTypeList
      :list="bridgeTypes"
      :selected-type="currentBridgeType"
      @select="selectBridgeType"
    />

    <!-- 构件库 -->
    <WidgetPanel
      :selected-type="currentBridgeType"
      :bridge-list="bridgeTypes"
      :widget-list="widgetList"
    />
  </div>
</template>
