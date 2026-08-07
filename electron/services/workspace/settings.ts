// 工作区目录与应用设置的 SQLite 持久化、路径校验和桌面 shell 集成
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import type { SQLOutputValue } from 'node:sqlite';
import path from 'node:path';
import { app, shell } from 'electron';
import {
  DEFAULT_CHAT_MODEL,
  DEFAULT_DEEPSEEK_MODEL,
  isChatModel,
  isDeepSeekModel,
} from '../../../shared/chat-model';
import { DEFAULT_IMAGE_MODEL, isImageModel } from '../../../shared/image-model';
import type { AppSettings, DesktopSettings } from '../../../shared/settings';
import { getApplicationDatabase } from '../../storage/app-database';

type DatabaseRow = Record<string, SQLOutputValue>;

export function getSuggestedWorkspacePath(): string {
  return path.join(app.getPath('documents'), 'Kytos');
}

function loadStoredSettings(): { appSettings: AppSettings; workspacePath: string | null } {
  const row = getApplicationDatabase()
    .prepare('SELECT * FROM application_settings WHERE id = 1')
    .get() as DatabaseRow;
  const workspacePath =
    typeof row.workspace_path === 'string' && path.isAbsolute(row.workspace_path)
      ? row.workspace_path
      : null;
  const deepseekModel = isDeepSeekModel(row.deepseek_model)
    ? row.deepseek_model
    : DEFAULT_DEEPSEEK_MODEL;
  return {
    appSettings: {
      deepseekModel,
      fastModel: isChatModel(row.fast_model) ? row.fast_model : 'deepseek-v4-flash',
      generalModel: isChatModel(row.general_model) ? row.general_model : DEFAULT_CHAT_MODEL,
      imageModel: isImageModel(row.image_model) ? row.image_model : DEFAULT_IMAGE_MODEL,
      theme: isDesktopTheme(row.theme) ? row.theme : 'system',
    },
    workspacePath,
  };
}

export function saveAppSettings(settings: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(settings);
  getApplicationDatabase()
    .prepare(
      `UPDATE application_settings
       SET theme = ?, deepseek_model = ?, fast_model = ?, general_model = ?, image_model = ?
       WHERE id = 1`,
    )
    .run(
      normalized.theme,
      normalized.deepseekModel,
      normalized.fastModel,
      normalized.generalModel,
      normalized.imageModel,
    );
  return normalized;
}

async function ensureDirectoryWritable(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
  const directoryStat = await stat(directoryPath);
  if (!directoryStat.isDirectory()) throw new Error('选择的位置不是文件夹');
  const probePath = path.join(directoryPath, `.kytos-write-test-${randomUUID()}`);
  try {
    await writeFile(probePath, '', { flag: 'wx' });
  } finally {
    await unlink(probePath).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') throw error;
    });
  }
}

export async function setWorkspaceDirectory(workspacePath: string): Promise<DesktopSettings> {
  if (!workspacePath || !path.isAbsolute(workspacePath)) throw new Error('工作区目录无效');
  const normalizedPath = path.normalize(workspacePath);
  await ensureDirectoryWritable(normalizedPath);
  await mkdir(path.join(normalizedPath, 'assets'), { recursive: true });
  getApplicationDatabase()
    .prepare('UPDATE application_settings SET workspace_path = ? WHERE id = 1')
    .run(normalizedPath);
  return getDesktopSettings();
}

export async function getWorkspaceDirectory(): Promise<string> {
  const { workspacePath } = loadStoredSettings();
  if (!workspacePath) throw new Error('尚未设置工作区目录');
  return workspacePath;
}

export async function getDesktopSettings(): Promise<DesktopSettings> {
  const settings = loadStoredSettings();
  return {
    appSettings: settings.appSettings,
    suggestedWorkspacePath: getSuggestedWorkspacePath(),
    workspacePath: settings.workspacePath,
  };
}

export async function openWorkspaceDirectory(): Promise<void> {
  const errorMessage = await shell.openPath(await getWorkspaceDirectory());
  if (errorMessage) throw new Error(errorMessage);
}

function normalizeAppSettings(settings: AppSettings): AppSettings {
  if (!settings || typeof settings !== 'object') throw new Error('应用设置无效');
  if (
    !isDesktopTheme(settings.theme) ||
    !isDeepSeekModel(settings.deepseekModel) ||
    !isChatModel(settings.fastModel) ||
    !isChatModel(settings.generalModel) ||
    !isImageModel(settings.imageModel)
  ) {
    throw new Error('应用设置无效');
  }
  return { ...settings };
}

function isDesktopTheme(value: unknown): value is AppSettings['theme'] {
  return value === 'dark' || value === 'light' || value === 'system';
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
