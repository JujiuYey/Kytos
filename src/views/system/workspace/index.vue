<script setup lang="ts">
import { ref } from 'vue';
import StatsCard from './components/StatsCard.vue';
import ProjectCard from './components/ProjectCard.vue';
import Setting from './components/Setting.vue';
import TrendChart from './components/TrendChart.vue';
import BarChart from './components/BarChart.vue';
import PieChart from './components/PieChart.vue';

// 模拟数据
const projects = ref([
  { id: 1, name: '项目 A', progress: 75, status: '进行中', color: 'bg-blue-500' },
  { id: 2, name: '项目 B', progress: 30, status: '进行中', color: 'bg-green-500' },
  { id: 3, name: '项目 C', progress: 90, status: '已完成', color: 'bg-purple-500' },
]);

function handleViewAllProjects() {
  // 处理查看所有项目
  console.log('查看所有项目');
}
</script>

<template>
  <div class="p-6">
    <!-- 欢迎区域 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold">
        工作台
      </h1>
      <p class="text-muted-foreground">
        欢迎回来，这是您的工作台概览
      </p>
    </div>

    <!-- 统计卡片 -->
    <StatsCard class="mb-6" />

    <!-- 主要内容区 -->
    <div class="grid gap-4 md:grid-cols-3 mb-6">
      <!-- 项目概览 -->
      <div class="md:col-span-2 flex">
        <ProjectCard
          title="项目概览"
          :projects="projects"
          class="flex-1"
          @view-all="handleViewAllProjects"
        />
      </div>

      <!-- 系统配置 -->
      <div class="flex">
        <Setting class="flex-1" />
      </div>
    </div>

    <!-- 图表区域 -->
    <div class="grid gap-4 mb-6 md:grid-cols-2">
      <!-- 趋势折线图 -->
      <TrendChart title="月度数据趋势" />

      <!-- 任务分布饼图 -->
      <PieChart title="任务状态分布" />
    </div>

    <!-- 项目统计柱状图 -->
    <div class="mb-6">
      <BarChart title="项目类型统计" />
    </div>
  </div>
</template>
