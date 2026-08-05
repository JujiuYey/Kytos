// 图片生成模型定义
export const IMAGE_MODELS = ['gpt-image-2'] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];

export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-2';

export function isImageModel(value: unknown): value is ImageModel {
  return typeof value === 'string' && IMAGE_MODELS.includes(value as ImageModel);
}
