<script setup lang="ts">
import { ref, computed } from 'vue';
import { Search } from 'lucide-vue-next';
import { builtinTemplates, templateCategories, getTemplatesByCategory, searchTemplates } from '@/data/prompt-templates';
import type { PromptTemplate } from '@/types';
import { toast } from 'vue-sonner';

// 响应式数据
const searchQuery = ref('');
const selectedCategory = ref<string>('all');

// 计算属性
const filteredTemplates = computed(() => {
  let templates = builtinTemplates;

  // 按分类筛选
  if (selectedCategory.value !== 'all') {
    templates = getTemplatesByCategory(selectedCategory.value);
  }

  // 按搜索词筛选
  if (searchQuery.value.trim()) {
    templates = searchTemplates(searchQuery.value);
  }

  return templates;
});

// 方法
function resetSearch() {
  searchQuery.value = '';
  selectedCategory.value = 'all';
}

function selectCategory(categoryId: string) {
  selectedCategory.value = categoryId;
  searchQuery.value = '';
}

function applyToInput(template: PromptTemplate) {
  // TODO: 实现复制到剪贴板或其他应用逻辑
  toast.success(`已应用模板：${template.name}`);
}

function applyAsSystem(template: PromptTemplate) {
  // TODO: 实现设置系统提示词逻辑
  toast.success(`已设置系统提示词：${template.name}`);
}
</script>

<template>
  <div class="container mx-auto p-6 max-w-7xl">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold flex items-center gap-2 mb-2">
        <span class="text-xl">🎯</span>
        提示词模板库
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        选择预设的提示词模板，快速开始专业对话
      </p>
    </div>

    <!-- 搜索框 -->
    <div class="relative mb-6 flex items-center">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        v-model="searchQuery"
        placeholder="搜索模板..."
        class="pl-10 max-w-md"
      />
      <Button
        v-if="searchQuery || selectedCategory !== 'all'"
        variant="outline"
        size="sm"
        class="ml-2"
        @click="resetSearch"
      >
        重置
      </Button>
    </div>

    <!-- 分类标签 -->
    <div class="flex flex-wrap gap-2 mb-6">
      <Badge
        variant="outline"
        class="cursor-pointer transition-colors"
        :class="{
          'bg-primary text-primary-foreground': selectedCategory === 'all',
        }"
        @click="selectCategory('all')"
      >
        全部
      </Badge>
      <Badge
        v-for="category of templateCategories"
        :key="category.id"
        variant="outline"
        class="cursor-pointer transition-colors"
        :class="{
          [category.color]: selectedCategory === category.id,
          'hover:bg-gray-100 dark:hover:bg-gray-800': selectedCategory !== category.id,
        }"
        @click="selectCategory(category.id)"
      >
        {{ category.name }}
      </Badge>
    </div>

    <!-- 模板列表 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <Card
        v-for="template of filteredTemplates"
        :key="template.id"
        class="cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/50 flex flex-col h-full"
      >
        <CardHeader class="pb-3 flex-shrink-0">
          <div class="flex items-center justify-start gap-2">
            <span class="text-lg">{{ template.icon || '📝' }}</span>
            <div>
              <CardTitle class="text-sm font-medium">
                {{ template.name }}
              </CardTitle>
            </div>
          </div>
          <Badge
            v-if="template.isSystem"
            variant="secondary"
            class="text-xs mt-1"
          >
            系统提示词
          </Badge>

          <CardDescription class="text-xs leading-relaxed line-clamp-3">
            {{ template.description }}
          </CardDescription>
        </CardHeader>

        <!-- 展开的模板内容 -->
        <div class="mx-4 bg-gray-50 dark:bg-gray-900 rounded-md p-3 mb-3">
          <p class="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap line-clamp-4">
            {{ template.prompt }}
          </p>
        </div>

        <!-- 操作按钮 -->
        <CardContent class="pt-0 mt-auto flex-shrink-0">
          <div class="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              class="flex-1 text-xs"
              @click.stop="applyToInput(template)"
            >
              复制
            </Button>
            <Button
              v-if="template.isSystem"
              size="sm"
              class="flex-1 text-xs"
              @click.stop="applyAsSystem(template)"
            >
              设为系统提示词
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 空状态 -->
    <div
      v-if="filteredTemplates.length === 0"
      class="text-center py-12 text-gray-500 dark:text-gray-400"
    >
      <span class="text-4xl mb-4 block">🔍</span>
      <p class="text-lg mb-2">
        没有找到匹配的模板
      </p>
      <p class="text-sm">
        尝试调整搜索条件或选择其他分类
      </p>
    </div>

    <!-- 底部提示 -->
    <div v-if="filteredTemplates.length > 0" class="border-t pt-6 mt-8">
      <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
        💡 提示：点击模板卡片可查看完整内容，点击按钮可应用模板
      </p>
    </div>
  </div>
</template>

<style scoped>
/* 文本截断样式 */
.line-clamp-3 {
  display: -webkit-box;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-4 {
  display: -webkit-box;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
