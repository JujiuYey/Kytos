// 请求参数校验与 imageUrls/data URI 归一化
import { IMAGE_SIZE_PATTERN, IMAGE_URL_LIMIT, GENERATION_RESOLUTIONS } from './constants';

// 远程参考图 URL 列表：必须是 https URL 或 data URI，长度受 IMAGE_URL_LIMIT 限制
export function validateImageUrls(imageUrls: string[] | undefined): void {
  if (!imageUrls) return;
  if (imageUrls.length === 0 || imageUrls.length > IMAGE_URL_LIMIT) {
    throw new Error(`图生图参考数量需在 1 到 ${IMAGE_URL_LIMIT} 张之间`);
  }
  for (const imageUrl of imageUrls) {
    if (
      typeof imageUrl !== 'string' ||
      !(imageUrl.startsWith('https://') || imageUrl.startsWith('data:image/'))
    ) {
      throw new Error('图生图参考必须是 HTTPS 图片地址或图片 data URI');
    }
  }
}

// 优先用 imageUrls；否则把单张参考图编码成 data URI
export function getImageUrls(request: {
  imageUrls?: string[];
  referenceImage?: { mimeType: string; fileData: Uint8Array };
}): string[] {
  if (request.imageUrls?.length) return request.imageUrls;
  if (!request.referenceImage) return [];
  return [
    `data:${request.referenceImage.mimeType};base64,${Buffer.from(request.referenceImage.fileData).toString('base64')}`,
  ];
}

// 生成请求的 size / resolution / n 字段校验
export function validateGenerationOptions(options: {
  size?: string;
  resolution?: string;
  n?: number;
}): { n: number; size: string; resolution: string } {
  const n = options.n ?? 1;
  if (!Number.isInteger(n) || n < 1 || n > 10) throw new Error('候选数量需在 1 到 10 之间');
  const size = options.size ?? '1:1';
  if (!IMAGE_SIZE_PATTERN.test(size)) throw new Error('图片比例无效');
  const resolution = options.resolution ?? '1k';
  if (!GENERATION_RESOLUTIONS.includes(resolution)) throw new Error('图片分辨率无效');
  return { n, size, resolution };
}
