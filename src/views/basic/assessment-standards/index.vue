<script setup lang="ts">
import { ref } from 'vue';
import Catalog from './components/catalog/index.vue';
import Indicator from './components/indicator/index.vue';
import Standards from './components/standards/index.vue';
import { catalog, assessmentIndicator } from './mock-data/index';

const currentCatalog = ref('');
function selectCatalog(current: string) {
  currentCatalog.value = current;
}

const indicatorList = computed(() => {
  return assessmentIndicator.filter(item => item.catalogId === currentCatalog.value);
});

const currentIndicator = ref('');
function selectIndicator(current: string) {
  currentIndicator.value = current;
}

const standardList = computed(() => {
  const found = indicatorList.value.find(item => item.id === currentIndicator.value);
  return found?.standards || [];
});
</script>

<template>
  <div class="flex h-full overflow-hidden">
    <!-- 左侧桥梁类型列表 -->
    <Catalog
      :list="catalog"
      :current="currentCatalog"
      @select="selectCatalog"
    />

    <!-- 评价指标 -->
    <Indicator
      :list="indicatorList"
      :current="currentIndicator"
      @select="selectIndicator"
    />

    <Standards
      :list="standardList"
      :current="currentIndicator"
    />
  </div>
</template>
