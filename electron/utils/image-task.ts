// GPT-Image-2 图像生成请求构造与字段校验
//
// 文档：https://docs.apimart.ai/cn/api-reference/model/gpt-image-2/image-generation
// 关键约束（按文档）：
//   - model 固定 gpt-image-2（兼容别名 gpt-image-2-ext）
//   - n 取值 1
//   - resolution ∈ {'1k', '2k', '4k'}
//   - size 支持 15 种比例 / 'auto' / 像素尺寸
//   - image_urls ≤ 16 张，单张 ≤ 20MB，总体 ≤ 256MB

export const GPT_IMAGE_2_MODEL = 'gpt-image-2' as const;
export const GPT_IMAGE_2_MODEL_ALIAS = 'gpt-image-2-ext' as const;

// 单张参考图上限
export { MAX_REFERENCE_IMAGE_SIZE } from '../constants/media';
// 参考图张数上限
export const MAX_REFERENCE_IMAGES = 16;
// 参考图总体积上限
export const MAX_TOTAL_REFERENCE_IMAGE_BYTES = 256 * 1024 * 1024;

export const GPT_IMAGE_2_RESOLUTIONS = ['1k', '2k', '4k'] as const;
export type GptImage2Resolution = (typeof GPT_IMAGE_2_RESOLUTIONS)[number];

export interface GptImage2Request {
  prompt: string;
  size: string;
  resolution: GptImage2Resolution;
  imageUrls?: string[];
  n?: number;
  officialFallback?: boolean;
}

// 构造 GPT-Image-2 接口的请求体，集中维护字段顺序 / 默认值 / model 字面量
export function buildGptImage2RequestBody(request: GptImage2Request): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: GPT_IMAGE_2_MODEL,
    prompt: request.prompt,
    resolution: request.resolution,
    size: request.size,
  };
  if (request.n !== undefined) body.n = request.n;
  if (request.imageUrls && request.imageUrls.length) body.image_urls = request.imageUrls;
  if (request.officialFallback) body.official_fallback = true;
  return body;
}

// 通用校验：resolution / n / imageUrls 数量 + 总体积
export interface GptImage2ValidationResult {
  ok: boolean;
  error?: string;
}

export function validateGptImage2Request(
  request: GptImage2Request,
  options: { totalImageBytes?: number } = {},
): GptImage2ValidationResult {
  if (!GPT_IMAGE_2_RESOLUTIONS.includes(request.resolution)) {
    return { ok: false, error: `不支持的 resolution: ${request.resolution}` };
  }
  if (request.n !== undefined) {
    if (!Number.isInteger(request.n) || request.n < 1 || request.n > 16) {
      return { ok: false, error: 'n 必须是 1 到 16 之间的整数' };
    }
  }
  if (request.imageUrls && request.imageUrls.length > MAX_REFERENCE_IMAGES) {
    return { ok: false, error: `image_urls 超过 ${MAX_REFERENCE_IMAGES} 张上限` };
  }
  if (options.totalImageBytes && options.totalImageBytes > MAX_TOTAL_REFERENCE_IMAGE_BYTES) {
    return {
      ok: false,
      error: `参考图总体积超过 ${Math.floor(MAX_TOTAL_REFERENCE_IMAGE_BYTES / 1024 / 1024)} MB`,
    };
  }
  return { ok: true };
}
