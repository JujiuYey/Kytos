// 角色视觉候选的资源校验 + 远程图片下载落盘
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import type { CharacterVisualImage } from '../../../shared/character-visual';
import type { GenerateCharacterVisualRequest } from '../../../shared/character-create';
import {
  MAX_REFERENCE_IMAGE_SIZE,
  MAX_RESULT_IMAGE_SIZE,
  REQUEST_TIMEOUT_MS,
  WORKSPACE_ASSETS_SUBDIRECTORY,
} from '../../constants';
import { getWorkspaceDirectory } from '../workspace';
import { ASSET_DIRECTORY } from './constants';
import { getAssetUrl } from './parsers';

// 单张参考图（用户上传的本地参考）大小、MIME 校验
export function validateReferenceImage(
  image: GenerateCharacterVisualRequest['referenceImage'],
): void {
  if (!image) return;
  if (
    !image.fileName ||
    path.basename(image.fileName) !== image.fileName ||
    !(image.fileData instanceof Uint8Array) ||
    image.fileData.byteLength === 0 ||
    image.fileData.byteLength > MAX_REFERENCE_IMAGE_SIZE ||
    !image.mimeType.startsWith('image/')
  ) {
    throw new Error('参考照片无效或超过 20 MB');
  }
}

// 把生成任务返回的 URL 下载到工作区并产出 CharacterVisualImage
export async function downloadImage(
  taskId: string,
  imageUrl: string,
  index: number,
): Promise<CharacterVisualImage> {
  const parsedUrl = new URL(imageUrl);
  if (parsedUrl.protocol !== 'https:') throw new Error('图片生成服务返回了不安全的图片地址');
  const response = await fetch(parsedUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`生成图片保存失败（HTTP ${response.status}）`);
  const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || 'image/png';
  const fileData = new Uint8Array(await response.arrayBuffer());
  if (!mimeType.startsWith('image/') || fileData.byteLength > MAX_RESULT_IMAGE_SIZE) {
    throw new Error('生成图片内容无效或超过 50 MB');
  }
  const extension =
    mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
  const fileName = `${taskId}-${index + 1}${extension}`;
  const assetDirectory = path.join(
    await getWorkspaceDirectory(),
    WORKSPACE_ASSETS_SUBDIRECTORY,
    ASSET_DIRECTORY,
  );
  await mkdir(assetDirectory, { recursive: true });
  await writeFile(path.join(assetDirectory, fileName), fileData);
  return { fileName, mimeType, name: '角色候选视觉', url: getAssetUrl(fileName) };
}

export { getAssetUrl };
