<script setup lang="ts">
import {
  Database,
  HardDrive,
  Save,
  AlertTriangle,
  Copy,
  Check,
  FileText,
  FileSpreadsheet,
  Trash2,
} from 'lucide-vue-next';
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { useClipboard } from '@vueuse/core';
import { initDatabase, getDatabase, createTables } from '@/services/database/database';
import { path } from '@tauri-apps/api';
import { readFile, exists, writeTextFile, writeFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';
import { save } from '@tauri-apps/plugin-dialog';
import { useAppStore } from '@/stores/app';

const appStore = useAppStore();

// 数据库状态
const dbStatus = ref('检查中...');
const dbSize = ref('计算中...');
const lastBackup = ref<string | null>(null);
const dbLocation = ref('');
const isLoading = ref(true);
const isExporting = ref(false);

// 数据库统计信息
const dbStats = ref({
  tableCount: 0,
  totalRecords: 0,
});

// 剪贴板功能
const { copy, copied } = useClipboard();

// 获取数据库文件大小
async function getDatabaseFileSize(): Promise<string> {
  try {
    const dbPath = await appDataDir();
    const fullPath = await join(dbPath, 'bridge.db');

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
    toast.error('获取数据库文件大小失败', {
      description: `${error}`,
    });
    return '未知';
  }
}

// 获取数据库位置
async function getDatabaseLocation(): Promise<string> {
  try {
    const storagePath = appStore.settings.storagePath;

    return await path.join(storagePath, 'data/bridge.db');
  } catch (error) {
    console.error('获取数据库位置失败:', error);
    return '未知';
  }
}

// 检查数据库连接状态
async function checkDatabaseStatus(): Promise<string> {
  try {
    const db = await getDatabase();
    // 执行一个简单的查询来测试连接
    await db?.execute('SELECT 1');
    return '已连接';
  } catch (error) {
    console.error('数据库连接检查失败:', error);
    return '连接失败';
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
      table_count: number;
    }>>(`
      SELECT 
        name,
        (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=m.name) as table_count
      FROM sqlite_master m 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);

    // 计算总记录数
    let totalRecords = 0;
    for (const table of tablesInfo) {
      try {
        const result = await db.select<Array<{ count: number }>>(`SELECT COUNT(*) as count FROM ${table.name}`);
        totalRecords += result?.[0]?.count || 0;
      } catch (error) {
        toast.error(`无法获取表 ${table.name} 的记录数`, {
          description: `${error}`,
        });
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
  isLoading.value = true;

  try {
    // 并行获取所有信息
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
    toast('加载失败', {
      description: '无法获取数据库信息',
    });
  } finally {
    isLoading.value = false;
  }
}

// 备份数据库
async function backupDatabase() {
  try {
    // 使用 Tauri 的对话框 API 让用户选择备份位置
    const backupPath = await save({
      defaultPath: `bridge-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.db`,
      filters: [{
        name: 'SQLite Database',
        extensions: ['db'],
      }],
    });

    if (backupPath) {
      // 读取原数据库文件
      const sourcePath = await getDatabaseLocation();
      const sourceData = await readFile(sourcePath);

      // 写入备份文件
      await writeFile(backupPath, sourceData);

      toast('数据库备份成功');
      lastBackup.value = new Date().toLocaleString();
    }
  } catch (error) {
    toast('备份失败', {
      description: `${error}`,
    });
  }
}

// 导出数据库为SQL
async function exportToSQL() {
  try {
    isExporting.value = true;
    const db = await getDatabase();
    if (!db) {
      throw new Error('无法连接到数据库');
    }

    // 获取所有表名
    const tables = await db.select<Array<{ name: string }>>(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'',
    );

    let sqlDump = `-- SQL 导出 - ${new Date().toLocaleString()}\n\n`;

    // 为每个表生成SQL
    for (const table of tables) {
      // 获取表结构
      const createTable = await db.select<Array<{ sql: string }>>(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='${table.name}'`,
      );

      if (createTable[0]?.sql) {
        sqlDump += `${createTable[0].sql};\n\n`;
      }

      // 获取表数据
      const rows = await db.select<Recordable[]>(`SELECT * FROM ${table.name}`);

      if (rows.length > 0) {
        sqlDump += `-- 数据表 ${table.name} 的数据\n`;

        for (const row of rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) {
              return 'NULL';
            }
            if (typeof val === 'string') {
              return `'${val.replace(/'/g, '\'\'')}'`;
            }
            return val;
          });

          sqlDump += `INSERT INTO ${table.name} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlDump += '\n';
      }
    }

    // 保存文件
    const filePath = await save({
      defaultPath: `bridge_export_${new Date().toISOString().split('T')[0]}.sql`,
      filters: [{ name: 'SQL Files', extensions: ['sql'] }],
    });

    if (filePath) {
      await writeTextFile(filePath, sqlDump);
      toast.success('导出成功', {
        description: '数据库已成功导出为SQL文件',
      });
    }
  } catch (error) {
    console.error('导出SQL失败:', error);
    toast.error('导出失败', {
      description: `${error}`,
    });
  } finally {
    isExporting.value = false;
  }
}

// 导出数据库为CSV
async function exportToCSV() {
  try {
    isExporting.value = true;
    const db = await getDatabase();
    if (!db) {
      throw new Error('无法连接到数据库');
    }

    // 获取所有表名
    const tables = await db.select<Array<{ name: string }>>(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'',
    );

    // 让用户选择保存位置
    const filePath = await save({
      defaultPath: `bridge_export_${new Date().toISOString().split('T')[0]}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (!filePath) {
      return;
    }

    // 导出第一个表到CSV
    if (tables.length > 0) {
      const tableName = tables[0]?.name || '';
      const rows = await db.select<Recordable[]>(`SELECT * FROM ${tableName}`);

      if (rows.length > 0 && rows[0]) {
        const columns = Object.keys(rows[0]);
        let csvContent = `${columns.join(',')}\n`;

        for (const row of rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null || val === undefined) {
              return '';
            }
            if (typeof val === 'string') {
              // 转义引号并用引号包裹
              return `"${val.replace(/"/g, '""')}"`;
            }
            return String(val);
          });
          csvContent += `${values.join(',')}\n`;
        }

        await writeTextFile(filePath, csvContent);

        toast.success('导出成功', {
          description: `表 ${tableName} 已成功导出为CSV文件`,
        });
      } else {
        toast.info('没有数据', {
          description: `表 ${tableName} 中没有数据`,
        });
      }
    } else {
      toast.info('没有表', {
        description: '数据库中没有可导出的表',
      });
    }
  } catch (error) {
    toast.error('导出失败', {
      description: `${error}`,
    });
  } finally {
    isExporting.value = false;
  }
}

// 复制数据库路径
async function copyDatabasePath() {
  try {
    await copy(dbLocation.value);
    toast('数据库路径已复制到剪贴板');
  } catch {
    toast('复制失败');
  }
}

// 刷新数据库信息
async function refreshInfo() {
  await loadDatabaseInfo();
  toast('刷新成功', {
    description: '数据库信息已更新',
  });
}

// 重置数据库
const showClearConfirm = ref(false);

async function resetDatabase() {
  try {
    const db = await getDatabase();
    if (!db) {
      throw new Error('无法连接到数据库');
    }

    // 获取所有用户表
    const tables = await db.select<Array<{ name: string }>>(
      'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'',
    );
    console.log('🚀 ~ resetDatabase ~ tables:', tables);

    // 删除所有表
    for (const table of tables) {
      const tableName = table.name;
      await db.execute(`DROP TABLE IF EXISTS "${tableName}"`);
    }

    // 重新创建所有表
    await createTables();

    // 刷新数据库信息
    await loadDatabaseInfo();
    toast.success('数据库重置成功');
  } catch (error) {
    toast.error('数据库重置失败', {
      description: `${error}`,
    });
  }
}

function openClearConfirm() {
  showClearConfirm.value = true;
}

function handleCancel() {
  showClearConfirm.value = false;
}

// 组件挂载时加载信息
onMounted(async () => {
  await initDatabase();
  await loadDatabaseInfo();
});
</script>

<template>
  <div class="space-y-6">
    <!-- 数据库状态卡片 -->
    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <Database class="h-6 w-6 text-primary" />
            <div>
              <CardTitle>数据库状态</CardTitle>
              <CardDescription>查看和管理数据库</CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            :disabled="isLoading"
            @click="refreshInfo"
          >
            {{ isLoading ? '加载中...' : '刷新' }}
          </Button>
        </div>
      </CardHeader>
      <CardContent class="space-y-6">
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
              <span>{{ dbStatus }}</span>
            </div>
          </div>
          <div class="space-y-1">
            <div class="text-sm font-medium text-muted-foreground">
              大小
            </div>
            <div class="flex items-center gap-2">
              <HardDrive class="h-4 w-4 text-muted-foreground" />
              <span>{{ dbSize }}</span>
            </div>
          </div>
        </div>

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
              class="h-6 w-6 ml-2"
              @click="copyDatabasePath"
            >
              <Copy v-if="!copied" class="h-3.5 w-3.5" />
              <Check v-else class="h-3.5 w-3.5 text-green-500" />
            </Button>
          </div>

          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="rounded-lg border bg-card p-4">
              <div class="text-sm font-medium">
                数据表数量
              </div>
              <div class="text-2xl font-bold">
                {{ dbStats.tableCount }}
              </div>
              <div class="text-xs text-muted-foreground">
                当前数据库中的表数量
              </div>
            </div>
            <div class="rounded-lg border bg-card p-4">
              <div class="text-sm font-medium">
                总记录数
              </div>
              <div class="text-2xl font-bold">
                {{ dbStats.totalRecords.toLocaleString() }}
              </div>
              <div class="text-xs text-muted-foreground">
                所有表中的记录总数
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 数据库操作卡片 -->
    <Card>
      <CardHeader>
        <CardTitle>数据库操作</CardTitle>
        <CardDescription>执行数据库维护任务</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="flex flex-col sm:flex-row gap-2">
            <Button
              :disabled="isLoading"
              @click="backupDatabase"
            >
              <Save class="w-4 h-4 mr-1" />
              备份数据库
            </Button>
            <Button
              :disabled="isLoading || isExporting"
              variant="outline"
              @click="exportToSQL"
            >
              <FileText class="w-4 h-4 mr-1" />
              导出SQL
            </Button>
            <Button
              :disabled="isLoading || isExporting"
              variant="outline"
              @click="exportToCSV"
            >
              <FileSpreadsheet class="w-4 h-4 mr-1" />
              导出CSV
            </Button>
            <Button
              :disabled="isLoading || isExporting"
              variant="destructive"
              @click="openClearConfirm"
            >
              <Trash2 class="w-4 h-4 mr-1" />
              删库跑路
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 警告信息 -->
    <div class="rounded-lg border bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
      <div class="flex items-center gap-2">
        <AlertTriangle class="h-5 w-5" />
        <h3 class="font-medium">
          重要提示
        </h3>
      </div>
      <p class="mt-2 text-sm">
        数据库操作可能会影响应用程序的正常运行。请确保在执行重要操作前已备份数据。
      </p>
    </div>

    <Dialog :open="showClearConfirm" @update:open="handleCancel">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>你敢删库跑路？！</DialogTitle>
          <DialogDescription>
            你确定要删除数据库吗？
            <br />
            <span class="text-red-500">此操作不可撤销，所有数据将被永久删除且不可恢复！</span>
          </DialogDescription>
        </DialogHeader>
        <div class="flex justify-end gap-2 pt-4">
          <Button variant="outline" @click="handleCancel">
            取消
          </Button>
          <Button variant="destructive" @click="resetDatabase">
            <Trash2 class="h-4 w-4 mr-1" />
            确认
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
