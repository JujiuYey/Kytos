<script setup lang="ts">
import { ArrowLeft } from 'lucide-vue-next';
import type { StructSection } from '@/views/basic/widget-data/mock-data/sections';

defineProps<{
  section: StructSection;
}>();

const emit = defineEmits<{
  (e: 'back'): void;
}>();

// 返回上一页
function handleBack() {
  emit('back');
}
</script>

<template>
  <div class="p-6 w-full h-full flex flex-col">
    <!-- 头部 -->
    <div class="flex items-center gap-2 mb-4">
      <Button class="h-8 px-2" @click="handleBack">
        <ArrowLeft class="h-4 w-4 mr-1" />
        返回
      </Button>

      <h2 class="text-2xl font-bold tracking-tight">
        {{ section.title }}
      </h2>
    </div>

    <div class="flex-1 grid grid-cols-[280px_420px_1fr] gap-4">
      <!-- 构件列表 -->
      <!--
        <WidgetList
        :widgets="widgets"
        :selected-widget="selectedWidget"
        @select="handleSelectWidget"
        />
      -->

      <!-- 病害列表 -->
      <!--
        <DiseaseTypeCard
        v-model="diseases"
        :selected-disease="selectedDisease || undefined"
        :widget-id="selectedWidget?.id || ''"
        @update:selected-disease="handleSelectDisease"
        @add="handleAddDisease"
        @edit="handleEditDisease"
        @delete="deleteDisease"
        />
      -->

      <!-- 病害等级 -->
      <!--
        <DiseaseLevelCard
        :disease="selectedDisease"
        :levels="currentDiseaseLevels"
        :selected-level="selectedLevel"
        @add="handleAddLevel"
        @edit="handleEditLevel"
        @delete="deleteLevel"
        @select="handleSelectLevel"
        @save="saveLevel"
        @cancel="isEditingLevel = false"
        />
      -->
    </div>
  </div>
</template>
