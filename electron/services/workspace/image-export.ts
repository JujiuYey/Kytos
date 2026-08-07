// 工作区图片扫描与分类导出
import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ExportWorkspaceImagesResult } from '../../../shared/file';
import { WORKSPACE_ASSETS_SUBDIRECTORY } from '../../constants';
import { isNodeError } from '../../utils/node-error';
import { getWorkspaceDirectory } from './settings';

const IMAGE_EXTENSIONS = new Set([
  '.avif',
  '.bmp',
  '.gif',
  '.heic',
  '.heif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
]);

const CATEGORY_NAMES: Readonly<Record<string, string>> = {
  'character-candidates': '角色候选',
  'character-expressions': '角色表情',
  'character-portraits': '角色视觉',
  'character-sheets': '角色参考板',
  illustrations: '插画',
  'story-frames': '故事分镜',
};

interface WorkspaceImage {
  categoryName: string;
  relativePath: string;
  sourcePath: string;
}

/** 把工作区中的图片复制到按类型整理的新目录。 */
export async function exportWorkspaceImages(
  destinationRoot: string,
): Promise<Omit<ExportWorkspaceImagesResult, 'canceled'>> {
  const destinationStat = await stat(destinationRoot);
  if (!destinationStat.isDirectory()) throw new Error('图片导出位置不是文件夹');

  const workspacePath = await getWorkspaceDirectory();
  const assetsRoot = path.join(workspacePath, WORKSPACE_ASSETS_SUBDIRECTORY);
  const images = await collectWorkspaceImages(assetsRoot);
  if (images.length === 0) {
    return { categoryCount: 0, directoryPath: null, fileCount: 0 };
  }

  const exportDirectory = await resolveExportDirectory(destinationRoot);
  const temporaryDirectory = await mkdtemp(path.join(destinationRoot, '.kytos-images-'));
  try {
    for (const image of images) {
      const destination = path.join(temporaryDirectory, image.categoryName, image.relativePath);
      await mkdir(path.dirname(destination), { recursive: true });
      await copyFile(image.sourcePath, destination);
    }
    await rename(temporaryDirectory, exportDirectory);
  } catch (error: unknown) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    throw error;
  }

  return {
    categoryCount: new Set(images.map(image => image.categoryName)).size,
    directoryPath: exportDirectory,
    fileCount: images.length,
  };
}

async function collectWorkspaceImages(assetsRoot: string): Promise<WorkspaceImage[]> {
  try {
    return await collectImagesInDirectory(assetsRoot, assetsRoot);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function collectImagesInDirectory(
  assetsRoot: string,
  currentDirectory: string,
): Promise<WorkspaceImage[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const images: WorkspaceImage[] = [];
  for (const entry of entries) {
    const sourcePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('Kytos-images-') || entry.name.startsWith('.kytos-images-')) {
        continue;
      }
      images.push(...(await collectImagesInDirectory(assetsRoot, sourcePath)));
      continue;
    }
    if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

    const sourceRelativePath = path.relative(assetsRoot, sourcePath);
    const [sourceCategory, ...remainingParts] = sourceRelativePath.split(path.sep);
    const categoryName = CATEGORY_NAMES[sourceCategory] ?? '其他图片';
    const relativePath = CATEGORY_NAMES[sourceCategory]
      ? remainingParts.join(path.sep)
      : sourceRelativePath;
    images.push({ categoryName, relativePath, sourcePath });
  }
  return images;
}

async function resolveExportDirectory(destinationRoot: string): Promise<string> {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const preferredPath = path.join(destinationRoot, `Kytos-images-${timestamp}`);
  try {
    await stat(preferredPath);
    return `${preferredPath}-${randomUUID().slice(0, 8)}`;
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') return preferredPath;
    throw error;
  }
}
