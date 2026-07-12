import Database from '@tauri-apps/plugin-sql';
import { toast } from 'vue-sonner';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '@/stores/app';

import { test_units } from './table-schemas/basic/test_units';
import { project } from './table-schemas/basic/project';
import { project_member } from './table-schemas/basic/project-member';
import { bridge } from './table-schemas/basic/bridge/basic-info';

const appStore = useAppStore();

let db: Database | null = null;
let isInitialized = false;

// 表结构定义
const tableSchemas = {
  test_units,
  project,
  project_member,
  bridge,
};

// 创建表
export async function createTables() {
  if (!db) {
    throw new Error('Database connection not established');
  }

  for (const schema of Object.values(tableSchemas)) {
    await db.execute(schema);
  }
}

// 初始化数据库连接和表
export async function initDatabase() {
  if (isInitialized) {
    return;
  }

  try {
    // 获取存储路径配置
    const storagePath = appStore.settings.storagePath;

    let dbPath: string;
    if (storagePath) {
      // 确保目录结构存在（data/ 和 uploads/）
      await invoke('ensure_storage_structure', { storagePath });

      // 使用配置的路径，数据库存储在 data 子目录
      // 将反斜杠转为正斜杠（Tauri SQL 插件要求）
      const normalizedPath = storagePath.replace(/\\/g, '/');
      dbPath = `sqlite:${normalizedPath}/data/bridge.db`;
    } else {
      toast.warning('存储路径未设置', {
        description: '数据库使用默认路径，建议在设置中配置存储路径',
      });
      return;
    }

    db = await Database.load(dbPath);
    await createTables();
    isInitialized = true;
  } catch (error) {
    toast.error('初始化数据库失败', {
      description: `${error}`,
    });
    throw error;
  }
}

// 获取数据库实例
export async function getDatabase() {
  await initDatabase();

  if (!db) {
    toast.error('数据库未初始化', {
      description: '请先初始化数据库',
    });
    throw new Error('Database not initialized');
  }
  return db;
}
