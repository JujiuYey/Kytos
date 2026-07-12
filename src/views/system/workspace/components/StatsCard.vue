<script setup lang="ts">
import { Folder, Clock, AlertCircle, CheckCircle, ArrowUpRight, ArrowDownRight } from 'lucide-vue-next';
import { computed } from 'vue';

interface StatItem {
  title: string;
  value: string | number;
  icon: string;
  description: string;
  trend?: 'up' | 'down' | 'alert' | 'none';
}

const stats = computed<StatItem[]>(() => [
  {
    title: '总项目数',
    value: '12',
    icon: 'Folder',
    description: '较上月 +20%',
    trend: 'up',
  },
  {
    title: '进行中',
    value: '5',
    icon: 'Clock',
    description: '较上月 +2',
    trend: 'up',
  },
  {
    title: '待审核',
    value: '3',
    icon: 'AlertCircle',
    description: '有新的审核请求',
    trend: 'alert',
  },
  {
    title: '已完成',
    value: '28',
    icon: 'CheckCircle',
    description: '总计完成项目',
    trend: 'none',
  },
]);

function getIcon(iconName: string) {
  const icons: Recordable = {
    Folder,
    Clock,
    AlertCircle,
    CheckCircle,
  };
  return icons[iconName] || null;
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <Card v-for="stat of stats" :key="stat.title" class="hover:shadow-md transition-shadow">
      <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle class="text-sm font-medium">
          {{ stat.title }}
        </CardTitle>
        <component :is="getIcon(stat.icon)" class="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div class="text-2xl font-bold">
          {{ stat.value }}
        </div>
        <p class="text-xs text-muted-foreground flex items-center">
          <template v-if="stat.trend === 'up'">
            <ArrowUpRight class="h-3 w-3 text-green-500 mr-1" />
          </template>
          <template v-else-if="stat.trend === 'down'">
            <ArrowDownRight class="h-3 w-3 text-red-500 mr-1" />
          </template>
          <template v-else-if="stat.trend === 'alert'">
            <AlertCircle class="h-3 w-3 text-amber-500 mr-1" />
          </template>
          {{ stat.description }}
        </p>
      </CardContent>
    </Card>
  </div>
</template>
