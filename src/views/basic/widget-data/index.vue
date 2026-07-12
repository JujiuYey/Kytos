<script setup lang="ts">
import { ref } from 'vue';
import WidgetPanel from './components/widget-panel/index.vue';
import BridgeTypeList from './components/bridge-type-list/index.vue';
import AssessmentStandards from './components/assessment-standards/index.vue';
import { bridgeWidgets } from './mock-data';
import { bridgeTypes } from './mock-data/bridge-types';
import type { Widget } from './types';
import type { StructSection } from './mock-data/sections';

const selectedType = ref('');
const widgetList = ref<Widget[]>([]);

/**
 * 处理桥梁类型选择
 * @param typeId
 */
function selectBridgeType(typeId: string) {
  selectedType.value = typeId;
  widgetList.value = bridgeWidgets.filter(widget => widget.bridgeTypeId === typeId);
}

/**
 * 查看部件评价标准
 */
const showAssessmentStandards = ref(false);
const currentSection = ref<StructSection | null>(null);
function handleViewAssessmentStandards(section: StructSection) {
  console.log('🚀 ~ handleViewAssessmentStandards ~ section:', section);
  currentSection.value = section;
  showAssessmentStandards.value = true;
}

/**
 * 返回
 */
function handleBack() {
  showAssessmentStandards.value = false;
  currentSection.value = null;
}
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 左侧桥梁类型列表 -->
    <BridgeTypeList
      :bridge-types="bridgeTypes"
      :selected-type="selectedType"
      @select="selectBridgeType"
    />

    <!-- 构件库 -->
    <WidgetPanel
      v-if="!showAssessmentStandards"
      :selected-type="selectedType"
      :bridge-types="bridgeTypes"
      :widget-list="widgetList"
      @view-assessment-standards="handleViewAssessmentStandards"
    />

    <!-- 评价标准 -->
    <AssessmentStandards
      v-if="showAssessmentStandards && currentSection"
      :section="currentSection"
      @back="handleBack"
    />
  </div>
</template>
