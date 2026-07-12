<script setup lang="ts">
import { Server, Settings, Database } from 'lucide-vue-next';
import OllamaServerConfig from './components/ollama-server-config.vue';
import AppConfig from './components/app-config.vue';
import DatabaseConfig from './components/database-config.vue';

const activeTab = ref('ollama');

// 密航配置
const settingTabs = [
  {
    key: 'ollama',
    title: 'AI 服务配置',
    icon: Server,
    description: 'Ollama 服务器连接设置',
  },
  {
    key: 'database',
    title: '数据库配置',
    icon: Database,
    description: '数据库连接和管理设置',
  },
  {
    key: 'app',
    title: '应用设置',
    icon: Settings,
    description: '应用行为偏好配置',
  },
];

// 切换标签
function switchTab(tabKey: string) {
  activeTab.value = tabKey;
}

// 获取标签按钮样式
function getTabButtonClass(tabKey: string) {
  return {
    'bg-primary text-primary-foreground shadow-sm': activeTab.value === tabKey,
    'hover:bg-accent hover:text-accent-foreground': activeTab.value !== tabKey,
    'transition-all duration-200': true,
  };
}
</script>

<template>
  <div class="container mx-auto p-6 max-w-7xl">
    <!-- 页面标题 -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold mb-2">
        系统设置
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        配置 AI 服务器连接、数据库设置以及应用行为偏好
      </p>
    </div>

    <!-- 主要内容区域 -->
    <div class="flex gap-6">
      <!-- 左侧导航 -->
      <div class="w-64 flex-shrink-0">
        <div class="sticky top-6">
          <div class="space-y-2">
            <div
              v-for="tab of settingTabs"
              :key="tab.key"
              :class="getTabButtonClass(tab.key)"
              class="flex items-start gap-3 p-3 rounded-lg cursor-pointer group"
              @click="switchTab(tab.key)"
            >
              <component
                :is="tab.icon"
                class="h-5 w-5 mt-0.5 flex-shrink-0"
              />
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm">
                  {{ tab.title }}
                </div>
                <div class="text-xs opacity-70 mt-1 line-clamp-2">
                  {{ tab.description }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧配置内容 -->
      <div class="flex-1 min-w-0">
        <div class="space-y-6">
          <!-- Ollama 服务器配置 -->
          <div v-if="activeTab === 'ollama'">
            <OllamaServerConfig />
          </div>

          <!-- 数据库配置 -->
          <div v-if="activeTab === 'database'">
            <DatabaseConfig />
          </div>

          <!-- 应用配置 -->
          <div v-if="activeTab === 'app'">
            <AppConfig />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-clamp: 2;
}
</style>
