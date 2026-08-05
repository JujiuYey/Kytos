// story 分镜图片的 URL 与文件 IO
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CharacterVisualImage } from '../../../shared/character-visual';
import { getWorkspaceDirectory } from '../workspace';
import {
  MAX_REFERENCE_IMAGE_SIZE,
  MAX_RESULT_IMAGE_SIZE,
  REQUEST_TIMEOUT_MS,
  WORKSPACE_ASSETS_SUBDIRECTORY,
} from '../../constants';
import { getImageExtension } from '../../utils';
import type { ApiTaskData } from '../../utils';
import { ASSET_DIRECTORY } from './constants';
import { getAssetUrl } from './parsers';
import type { DownloadedImage } from './types';

async function getAssetDirectory(): Promise<string> {
  return path.join(await getWorkspaceDirectory(), WORKSPACE_ASSETS_SUBDIRECTORY, ASSET_DIRECTORY);
}

export async function downloadTaskImages(
  taskId: string,
  taskData: ApiTaskData,
): Promise<DownloadedImage[]> {
  const imageUrls = taskData.result?.images?.flatMap(image => image.url) ?? [];
  if (imageUrls.length === 0) {
    throw new Error('分镜图片生成任务已完成，但没有返回图片');
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
  const imageData = await readFile(
    path.join(
      await getWorkspaceDirectory(),
      WORKSPACE_ASSETS_SUBDIRECTORY,
      directory,
      image.fileName,
    ),
  );
  if (imageData.byteLength > MAX_REFERENCE_IMAGE_SIZE) {
    throw new Error('参考图片超过 20 MB，无法用于故事图片生成');
  }
  return `data:${image.mimeType};base64,${imageData.toString('base64')}`;
}

export async function deleteVersionImages(
  versions: { images: CharacterVisualImage[] }[],
): Promise<void> {
  const assetDirectory = await getAssetDirectory();
  await Promise.all(
    versions.flatMap(version =>
      version.images.map(image =>
        unlink(path.join(assetDirectory, image.fileName)).catch(() => undefined),
      ),
    ),
  );
}
