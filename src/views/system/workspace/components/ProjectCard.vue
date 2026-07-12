<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-vue-next';

interface Project {
  id: number;
  name: string;
  progress: number;
  status: string;
  color: string;
  dueDate?: string;
}

interface Props {
  title: string;
  projects: Project[];
}

defineProps<Props>();
defineEmits(['viewAll']);
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <CardTitle>{{ title }}</CardTitle>
        <Button variant="ghost" size="sm" @click="$emit('viewAll')">
          查看全部
          <ChevronRight class="ml-1 h-4 w-4" />
        </Button>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <div v-for="project of projects" :key="project.id" class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">{{ project.name }}</span>
          <span class="text-xs text-muted-foreground">{{ project.status }}</span>
        </div>
        <div class="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            class="h-full rounded-full"
            :class="[project.color]"
            :style="{ width: `${project.progress}%` }"
          />
        </div>
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>进度 {{ project.progress }}%</span>
          <span>{{ project.dueDate || '' }}</span>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
