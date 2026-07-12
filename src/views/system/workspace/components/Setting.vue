<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Database, HardDrive, Copy, Check, Settings } from 'lucide-vue-next';
import { useAppStore } from '@/stores/app';
import { initDatabase, getDatabase } from '@/services/database/database';
import { useClipboard } from '@vueuse/core';
import { toast } from 'vue-sonner';
import { readFile, exists } from '@tauri-apps/plugin-fs';
import { path } from '@tauri-apps/api';

const appStore = useAppStore();
const router = useRouter();
const { copy, copied } = useClipboard();

// 检查是否已配置存储路径
const hasStoragePath = computed(() => {
  return !!appStore.settings.storagePath;
});

// 数据库状态
const dbStatus = ref('检查中...');
const dbSize = ref('计算中...');
const dbLocation = ref('');
const isLoading = ref(true);

// 数据库统计信息
const dbStats = ref({
  tableCount: 0,
  totalRecords: 0,
});

// 跳转到设置页面
function goToSettings() {
  router.push('/system/app-setting');
}

// 获取数据库文件大小
async function getDatabaseFileSize(): Promise<string> {
  try {
    const storagePath = appStore.settings.storagePath;
    if (!storagePath) {
      return '0 B';
    }

    const fullPath = await path.join(storagePath, 'data', 'bridge.db');

    if (await exists(fullPath)) {
      const fileData = await readFile(fullPath);
      const sizeInBytes = fileData.length;

      if (sizeInBytes < 1024) {
        return `${sizeInBytes} B`;
      } else if (sizeInBytes < 1024 * 1024) {
        return `${(sizeInBytes / 1024).toFixed(1)} KB`;
      } else {
        return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
      }
    }
    return '0 B';
  } catch (error) {
    console.error('获取数据库文件大小失败:', error);
    return '未知';
  }
}

// 获取数据库位置
async function getDatabaseLocation(): Promise<string> {
  try {
    const storagePath = appStore.settings.storagePath;
    if (!storagePath) {
      return '未设置';
    }

    return await path.join(storagePath, 'data', 'bridge.db');
  } catch (error) {
    console.error('获取数据库位置失败:', error);
    return '未知';
  }
}

// 检查数据库连接状态
async function checkDatabaseStatus(): Promise<string> {
  try {
    const db = await getDatabase();
    await db?.execute('SELECT 1');
    return '已连接';
  } catch (error) {
    console.error('数据库连接检查失败:', error);
    return '未连接';
  }
}

// 获取数据库统计信息
async function getDatabaseStats() {
  try {
    const db = await getDatabase();
    if (!db) {
      return {
        tableCount: 0,
        totalRecords: 0,
      };
    }

    // 获取所有表的统计信息
    const tablesInfo = await db.select<Array<{
      name: string;
    }>>(`
      SELECT name
      FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    // 计算总记录数
    let totalRecords = 0;
    for (const table of tablesInfo) {
      try {
        const result = await db.select<Array<{ count: number }>>(`SELECT COUNT(*) as count FROM ${table.name}`);
        totalRecords += result?.[0]?.count || 0;
      } catch (error) {
        console.error(`无法获取表 ${table.name} 的记录数:`, error);
      }
    }

    return {
      tableCount: tablesInfo.length,
      totalRecords,
    };
  } catch (error) {
    console.error('获取数据库统计信息失败:', error);
    return { tableCount: 0, totalRecords: 0 };
  }
}

// 加载数据库信息
async function loadDatabaseInfo() {
  if (!hasStoragePath.value) {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;

  try {
    const [status, size, location, stats] = await Promise.all([
      checkDatabaseStatus(),
      getDatabaseFileSize(),
      getDatabaseLocation(),
      getDatabaseStats(),
    ]);

    dbStatus.value = status;
    dbSize.value = size;
    dbLocation.value = location;
    dbStats.value = stats;
  } catch (error) {
    console.error('加载数据库信息失败:', error);
  } finally {
    isLoading.value = false;
  }
}

// 复制数据库路径
async function copyDatabasePath() {
  try {
    await copy(dbLocation.value);
    toast.success('数据库路径已复制到剪贴板');
  } catch {
    toast.error('复制失败');
  }
}

// 刷新数据库信息
async function refreshInfo() {
  await loadDatabaseInfo();
  toast.success('刷新成功');
}

// 组件挂载时加载信息
onMounted(async () => {
  await initDatabase();
  await loadDatabaseInfo();
});
</script>

<template>
  <Card>
    <CardHeader>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Database class="h-5 w-5 text-primary" />
          <CardTitle>数据库链接</CardTitle>
        </div>
      </div>
    </CardHeader>
    <CardContent class="space-y-4">
      <!-- 未设置存储路径 -->
      <div v-if="!hasStoragePath" class="space-y-4">
        <div class="rounded-lg border-2 border-dashed border-yellow-500/50 bg-yellow-50 dark:bg-yellow-900/20 p-6 text-center">
          <AlertTriangle class="h-12 w-12 mx-auto mb-3 text-yellow-600 dark:text-yellow-400" />
          <h3 class="font-semibold text-lg mb-2 text-yellow-900 dark:text-yellow-200">
            存储路径未设置
          </h3>
          <p class="text-sm text-yellow-800 dark:text-yellow-300 mb-4">
            请先在设置中配置存储路径，以便应用程序可以正常存储数据和文件
          </p>
          <Button @click="goToSettings">
            <Settings class="w-4 h-4 mr-2" />
            前往设置
          </Button>
        </div>
      </div>

      <!-- 已设置存储路径 - 显示数据库信息 -->
      <div v-else class="space-y-4">
        <!-- 状态概览 -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1">
            <div class="text-sm font-medium text-muted-foreground">
              状态
            </div>
            <div class="flex items-center gap-2">
              <span
                class="h-2 w-2 rounded-full"
                :class="dbStatus === '已连接' ? 'bg-green-500' : 'bg-red-500'"
              />
              <span class="text-sm">{{ dbStatus }}</span>
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-sm font-medium text-muted-foreground">
              大小
            </div>
            <div class="flex items-center gap-2">
              <HardDrive class="h-4 w-4 text-muted-foreground" />
              <span class="text-sm">{{ dbSize }}</span>
            </div>
          </div>
        </div>

        <!-- 存储位置 -->
        <div class="space-y-1">
          <div class="text-sm font-medium text-muted-foreground">
            存储位置
          </div>
          <div class="flex items-center gap-2 bg-muted/50 rounded-md p-2">
            <div class="flex-1 truncate text-xs font-mono" :title="dbLocation">
              {{ dbLocation }}
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="h-6 w-6 ml-2 flex-shrink-0"
              @click="copyDatabasePath"
            >
              <Copy v-if="!copied" class="h-3.5 w-3.5" />
              <Check v-else class="h-3.5 w-3.5 text-green-500" />
            </Button>
          </div>
        </div>

        <!-- 统计信息 -->
        <div class="grid gap-3 grid-cols-2">
          <div class="rounded-lg border bg-card p-3">
            <div class="text-xs font-medium text-muted-foreground">
              数据表
            </div>
            <div class="text-xl font-bold">
              {{ dbStats.tableCount }}
            </div>
          </div>
          <div class="rounded-lg border bg-card p-3">
            <div class="text-xs font-medium text-muted-foreground">
              总记录数
            </div>
            <div class="text-xl font-bold">
              {{ dbStats.totalRecords.toLocaleString() }}
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="isLoading"
            class="flex-1"
            @click="refreshInfo"
          >
            {{ isLoading ? '加载中...' : '链接数据库' }}
          </Button>
          <Button
            variant="outline"
            size="sm"
            class="flex-1"
            @click="goToSettings"
          >
            <Settings class="w-3.5 h-3.5 mr-1" />
            更多设置
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
