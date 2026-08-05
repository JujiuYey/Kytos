// 角色视觉图片的工作区文件 IO：上传保存、生成下载、参考图读取
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isPlainObject } from 'es-toolkit';
import type { SaveFileRequest, SavedFileResult } from '../../../shared/desktop';
import type { CharacterVisualImage } from '../../../shared/character-visual';
import { getWorkspaceDirectory } from '../workspace';
import { MAX_NAME_LENGTH, MAX_REFERENCE_IMAGE_SIZE, MAX_RESULT_IMAGE_SIZE } from './constants';
import { getCharacterAssetUrl } from './parsers';
import { getImageExtension } from '../../utils';
import type { ApiTaskData } from '../../utils';

function validateImageUploadRequest(request: SaveFileRequest & { name?: string }): void {
  if (
    !isPlainObject(request) ||
    typeof request.fileName !== 'string' ||
    path.basename(request.fileName) !== request.fileName ||
    !(request.fileData instanceof Uint8Array) ||
    typeof request.mimeType !== 'string' ||
    !request.mimeType.startsWith('image/')
  ) {
    throw new Error('上传的角色图片无效');
  }
  if (request.fileData.byteLength === 0 || request.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('角色图片大小必须在 20 MB 以内');
  }
  if (
    request.name !== undefined &&
    (typeof request.name !== 'string' ||
      !request.name.trim() ||
      request.name.length > MAX_NAME_LENGTH)
  ) {
    throw new Error('角色视觉名称无效');
  }
}

function getUploadedImageExtension(request: SaveFileRequest): string {
  const mimeExtensions: Record<string, string> = {
    'image/avif': '.avif',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  const mimeType = request.mimeType.split(';', 1)[0]?.trim().toLowerCase();
  if (mimeType && mimeExtensions[mimeType]) {
    return mimeExtensions[mimeType];
  }
  const extension = path.extname(request.fileName).toLowerCase();
  if (['.avif', '.jpeg', '.jpg', '.png', '.webp'].includes(extension)) {
    return extension;
  }
  throw new Error('仅支持 PNG、JPEG、WebP 或 AVIF 图片');
}

export async function saveUploadedImage(
  request: SaveFileRequest & { name?: string },
  assetDirectoryName: string,
): Promise<{ image: CharacterVisualImage; result: SavedFileResult; uploadId: string }> {
  validateImageUploadRequest(request);
  const workspacePath = await getWorkspaceDirectory();
  const assetDirectory = path.join(workspacePath, 'assets', assetDirectoryName);
  const uploadId = `upload_${randomUUID()}`;
  const fileName = `${uploadId}${getUploadedImageExtension(request)}`;
  const destination = path.join(assetDirectory, fileName);
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(destination, request.fileData, { flag: 'wx' });

  const url = getCharacterAssetUrl(assetDirectoryName, fileName);
  return {
    image: {
      fileName,
      mimeType: request.mimeType,
      name: request.name?.trim(),
      url,
    },
    result: {
      fileName,
      mimeType: request.mimeType,
      originalName: request.fileName,
      size: request.fileData.byteLength,
      url,
    },
    uploadId,
  };
}

export async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
  assetDirectoryName: string,
  name: string,
): Promise<CharacterVisualImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('图片生成任务已完成，但没有返回图片');
  }

  const workspacePath = await getWorkspaceDirectory();
  const assetDirectory = path.join(workspacePath, 'assets', assetDirectoryName);
  await mkdir(assetDirectory, { recursive: true });

  return Promise.all(
    imageUrls.map(async (imageUrl, index) => {
      const parsedImageUrl = new URL(imageUrl);
      if (parsedImageUrl.protocol !== 'https:') {
        throw new Error('图片生成服务返回了不安全的图片地址');
      }
      const response = await fetch(parsedImageUrl, { signal: AbortSignal.timeout(60_000) });
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
      const extension = getImageExtension(mimeType, imageUrl);
      const fileName = `${taskId}-${index + 1}${extension}`;
      const fileData = new Uint8Array(await response.arrayBuffer());
      if (fileData.byteLength > MAX_RESULT_IMAGE_SIZE) {
        throw new Error('生成图片超过 50 MB，无法保存');
      }
      await writeFile(path.join(assetDirectory, fileName), fileData);
      return {
        fileName,
        mimeType,
        name: imageUrls.length > 1 ? `${name} ${index + 1}` : name,
        url: getCharacterAssetUrl(assetDirectoryName, fileName),
      };
    }),
  );
}

export async function readOfficialReferenceImage(
  directoryName: string,
  image: { fileName: string; mimeType: string },
): Promise<string> {
  const workspacePath = await getWorkspaceDirectory();
  const imageData = await readFile(
    path.join(workspacePath, 'assets', directoryName, image.fileName),
  );
  if (imageData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error(`正式角色视觉图片“${image.fileName}”超过 20 MB`);
  }
  return `data:${image.mimeType};base64,${imageData.toString('base64')}`;
}

export async function deleteAssetFile(directoryName: string, fileName: string): Promise<void> {
  const workspacePath = await getWorkspaceDirectory();
  await unlink(path.join(workspacePath, 'assets', directoryName, fileName));
}
