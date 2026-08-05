// 工作区目录与桌面设置：JSON 持久化、路径校验、桌面 shell 集成
import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, shell } from 'electron';
import type { DesktopSettings } from '../../../shared/desktop';
import { isNodeError, readJsonFile, writeJsonFile } from '../../storage/json-store';
import { isPlainObject } from 'es-toolkit';

interface StoredSettings {
  workspacePath: string | null;
}

let storedSettingsCache: StoredSettings | null = null;

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getSuggestedWorkspacePath(): string {
  return path.join(app.getPath('documents'), 'Kytos');
}

async function loadStoredSettings(): Promise<StoredSettings> {
  if (storedSettingsCache) {
    return storedSettingsCache;
  }

  const value = await readJsonFile(getSettingsFilePath());
  const workspacePath =
    isPlainObject(value) &&
    'workspacePath' in value &&
    typeof value.workspacePath === 'string' &&
    path.isAbsolute(value.workspacePath)
      ? value.workspacePath
      : null;

  storedSettingsCache = { workspacePath };
  return storedSettingsCache;
}

async function saveStoredSettings(settings: StoredSettings): Promise<void> {
  await writeJsonFile(getSettingsFilePath(), settings);
  storedSettingsCache = settings;
}

async function ensureDirectoryWritable(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
  const directoryStat = await stat(directoryPath);
  if (!directoryStat.isDirectory()) {
    throw new Error('选择的位置不是文件夹');
  }

  const probePath = path.join(directoryPath, `.kytos-write-test-${randomUUID()}`);
  try {
    await writeFile(probePath, '', { flag: 'wx' });
  } finally {
    await unlink(probePath).catch((error: unknown) => {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    });
  }
}

export async function setWorkspaceDirectory(workspacePath: string): Promise<DesktopSettings> {
  if (!workspacePath || !path.isAbsolute(workspacePath)) {
    throw new Error('工作区目录无效');
  }

  const normalizedPath = path.normalize(workspacePath);
  await ensureDirectoryWritable(normalizedPath);
  await mkdir(path.join(normalizedPath, 'assets'), { recursive: true });
  await saveStoredSettings({ workspacePath: normalizedPath });
  return getDesktopSettings();
}

export async function getWorkspaceDirectory(): Promise<string> {
  const settings = await loadStoredSettings();
  if (!settings.workspacePath) {
    throw new Error('尚未设置工作区目录');
  }
  return settings.workspacePath;
}

export async function getDesktopSettings(): Promise<DesktopSettings> {
  const settings = await loadStoredSettings();
  return {
    suggestedWorkspacePath: getSuggestedWorkspacePath(),
    workspacePath: settings.workspacePath,
  };
}

export async function openWorkspaceDirectory(): Promise<void> {
  const workspacePath = await getWorkspaceDirectory();
  const errorMessage = await shell.openPath(workspacePath);
  if (errorMessage) {
    throw new Error(errorMessage);
  }
}
