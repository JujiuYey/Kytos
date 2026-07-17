import { randomUUID } from 'node:crypto';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, shell } from 'electron';
import type { DesktopSettings, SaveFileRequest, SavedFileResult } from '../../shared/desktop';
import { isNodeError, readJsonFile, writeJsonFile } from './json-store';

interface StoredSettings {
  workspacePath: string | null;
}

let storedSettingsCache: StoredSettings | null = null;

function getSettingsFilePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function getSuggestedWorkspacePath(): string {
  return path.join(app.getPath('documents'), 'IP Creator');
}

async function loadStoredSettings(): Promise<StoredSettings> {
  if (storedSettingsCache) {
    return storedSettingsCache;
  }

  const value = await readJsonFile(getSettingsFilePath());
  const workspacePath =
    value &&
    typeof value === 'object' &&
    'workspacePath' in value &&
    typeof value.workspacePath === 'string' &&
    path.isAbsolute(value.workspacePath)
      ? value.workspacePath
      : null;

  storedSettingsCache = { workspacePath };
  return storedSettingsCache;
}

export async function getWorkspaceDirectory(): Promise<string> {
  const settings = await loadStoredSettings();
  if (!settings.workspacePath) {
    throw new Error('尚未设置工作区目录');
  }
  return settings.workspacePath;
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

  const probePath = path.join(directoryPath, `.ip-creator-write-test-${randomUUID()}`);
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

function createStoredFileName(originalName: string): string {
  const extension = path.extname(originalName);
  const baseName =
    path
      .basename(originalName, extension)
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/^-+|-+$/g, '') || 'file';

  return `${baseName}-${randomUUID().slice(0, 8)}${extension}`;
}

function validateSaveFileRequest(request: SaveFileRequest): void {
  if (!request || typeof request !== 'object') {
    throw new Error('文件参数无效');
  }
  if (!request.fileName || path.basename(request.fileName) !== request.fileName) {
    throw new Error('文件名无效');
  }
  if (!(request.fileData instanceof Uint8Array)) {
    throw new TypeError('文件内容无效');
  }
}

export async function saveWorkspaceFile(request: SaveFileRequest): Promise<SavedFileResult> {
  validateSaveFileRequest(request);

  const workspacePath = await getWorkspaceDirectory();
  const storagePath = path.join(workspacePath, 'assets');
  const storedFileName = createStoredFileName(request.fileName);
  const destination = path.join(storagePath, storedFileName);
  await mkdir(storagePath, { recursive: true });
  await writeFile(destination, request.fileData, { flag: 'wx' });

  return {
    fileName: storedFileName,
    originalName: request.fileName,
    url: pathToFileURL(destination).toString(),
    size: request.fileData.byteLength,
    mimeType: request.mimeType || 'application/octet-stream',
  };
}
