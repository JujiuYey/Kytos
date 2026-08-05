// 媒体相关的尺寸 / MIME 常量

// 用户上传参考图的最大体积
export const MAX_REFERENCE_IMAGE_SIZE = 20 * 1024 * 1024;
// 镜像生成服务返回图片的最大体积
export const MAX_RESULT_IMAGE_SIZE = 50 * 1024 * 1024;

// 常见图片 MIME → 文件后缀映射
export const MIME_EXTENSIONS: Record<string, string> = {
  'image/avif': '.avif',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// 允许落盘的图片文件后缀列表
export const ACCEPTED_IMAGE_EXTENSIONS: readonly string[] = [
  '.avif',
  '.jpeg',
  '.jpg',
  '.png',
  '.webp',
];
