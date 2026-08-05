// illustration 模块的工作区文件 IO：上传校验、生成图下载、参考图 data URI 编码、文件清理
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { UploadIllustrationRequest } from '../../../shared/illustration';
import type { CharacterVisualImage } from '../../../shared/character-visual';
import {
  ACCEPTED_IMAGE_EXTENSIONS,
  MAX_REFERENCE_IMAGE_SIZE,
  MAX_RESULT_IMAGE_SIZE,
  REQUEST_TIMEOUT_MS,
  WORKSPACE_ASSETS_SUBDIRECTORY,
} from '../../constants';
import { getImageExtension } from '../../utils';
import type { ApiTaskData } from '../../utils';
import { getWorkspaceDirectory } from '../workspace';
import { ASSET_DIRECTORY } from './constants';
import { getAssetUrl } from './parsers';

function validateUploadRequest(request: UploadIllustrationRequest): void {
  if (
    !request ||
    typeof request.fileName !== 'string' ||
    !request.fileName.trim() ||
    path.basename(request.fileName) !== request.fileName ||
    !(request.fileData instanceof Uint8Array) ||
    typeof request.mimeType !== 'string' ||
    !request.mimeType.startsWith('image/')
  ) {
    throw new Error('上传的插画图片无效');
  }
  if (request.fileData.byteLength === 0 || request.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('插画图片大小必须在 20 MB 以内');
  }
}

function getUploadedImageExtension(request: UploadIllustrationRequest): string {
  const mimeType = request.mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (mimeType) {
    const fromMime = getImageExtension(mimeType, request.fileName);
    if (ACCEPTED_IMAGE_EXTENSIONS.includes(fromMime)) {
      return fromMime;
    }
  }
  const extension = path.extname(request.fileName).toLowerCase();
  if (ACCEPTED_IMAGE_EXTENSIONS.includes(extension)) {
    return extension;
  }
  throw new Error('仅支持 PNG、JPEG、WebP 或 AVIF 图片');
}

async function getAssetDirectory(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), WORKSPACE_ASSETS_SUBDIRECTORY, ASSET_DIRECTORY);
}

export async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
): Promise<CharacterVisualImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('插画生成任务已完成，但没有返回图片');
  }
  const assetDirectory = await getAssetDirectory();
  await mkdir(assetDirectory, { recursive: true });
  return Promise.all(
    imageUrls.map(async (imageUrl, index) => {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.protocol !== 'https:') {
        throw new Error('图片生成服务返回了不安全的图片地址');
      }
      const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`生成图片保存失败（HTTP ${response.status}）`);
      }
      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_RESULT_IMAGE_SIZE) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
      if (!mimeType.startsWith('image/')) {
        throw new Error('图片生成服务返回了无效的图片内容');
      }
      const fileData = new Uint8Array(await response.arrayBuffer());
      if (fileData.byteLength > MAX_RESULT_IMAGE_SIZE) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      const fileName = `${taskId}-${index + 1}${getImageExtension(mimeType, imageUrl)}`;
      await writeFile(path.join(assetDirectory, fileName), fileData);
      return { fileName, mimeType, url: getAssetUrl(fileName) };
    }),
  );
}

export async function readReferenceImage(
  directory: string,
  image: CharacterVisualImage,
): Promise<string> {
  const workspacePath = await getWorkspaceDirectory();
  const imageData = await readFile(
    path.join(workspacePath, WORKSPACE_ASSETS_SUBDIRECTORY, directory, image.fileName),
  );
  if (imageData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('参考图片超过 20 MB，无法用于插画生成');
  }
  return `data:${image.mimeType};base64,${imageData.toString('base64')}`;
}

export async function saveUploadedIllustrationFile(
  request: UploadIllustrationRequest,
): Promise<string> {
  validateUploadRequest(request);
  const fileName = `upload_${randomUUID()}${getUploadedImageExtension(request)}`;
  const assetDirectory = await getAssetDirectory();
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(path.join(assetDirectory, fileName), request.fileData, { flag: 'wx' });
  return fileName;
}

export async function safeUnlinkAssetFile(fileName: string): Promise<void> {
  const assetDirectory = await getAssetDirectory();
  await unlink(path.join(assetDirectory, fileName)).catch(() => undefined);
}

export async function safeUnlinkAssetFiles(fileNames: string[]): Promise<void> {
  await Promise.all(fileNames.map(safeUnlinkAssetFile));
}
