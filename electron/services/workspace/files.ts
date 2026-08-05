// 工作区文件落盘：把上传文件保存到 workspace/assets 下并返回可访问的 URL
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { SaveFileRequest, SavedFileResult } from '../../../shared/desktop';
import { isPlainObject } from 'es-toolkit';
import { getWorkspaceDirectory } from './settings';

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
  if (!isPlainObject(request)) {
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
