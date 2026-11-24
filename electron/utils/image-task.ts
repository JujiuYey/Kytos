// 图像生成请求构造。四个模型共用同一接口，参数和限制按模型不同
//
// 文档：https://docs.apimart.ai/cn/api-reference/images/gpt-image-2.6/generation
//       https://docs.apimart.ai/cn/api-reference/images/gemini-nano-banana-2.1/generation
//       https://docs.apimart.ai/cn/api-reference/images/seedream-5-5/generation
//       https://docs.apimart.ai/cn/api-reference/images/minimax-h3-image/generation
// 关键约束（按文档）：
//   - size 传比例名，resolution 传档位；出图张数、参考图张数、清晰度的上限见 IMAGE_MODEL_DEFINITIONS
//   - quality 只有 GPT-Image-2.6 有；MiniMax H3 Image 收到后会忽略
//   - 参考图：GPT-Image-2.6 只收公网 HTTP(S) 直链，要先经上传接口；其余三个也收 data URI
//   - MiniMax H3 Image 不传档位时默认按 4K 出图并计费，所以档位必须显式传
import { IMAGE_MODEL_DEFINITIONS } from '../../shared/image-model';
import type { ImageModel, ImageResolution } from '../../shared/image-model';
import { prepareImageReferences } from './api-upload';

// 单张参考图上限
export { MAX_REFERENCE_IMAGE_SIZE } from '../constants/media';
export type { ImageResolution };

export interface ImageGenerationRequest {
  model: ImageModel;
  prompt: string;
  size: string;
  resolution: ImageResolution;
  imageUrls?: string[];
  n?: number;
}

// 请求写法上各模型的差异
interface RequestFormat {
  // 每次请求都附带的固定参数
  fixedParams?: Record<string, unknown>;
  // 分辨率档位在接口里的写法，省略时沿用应用内的小写
  resolutionValue?: (resolution: ImageResolution) => string;
  // 接口没有对应比例时改用的精确像素尺寸，键是比例，值是各档位下的尺寸；此时不传档位
  exactSizes?: Record<string, Partial<Record<ImageResolution, string>>>;
}

// GPT-Image-2.6 固定传 medium。不传或传 auto 时，档位由模型临时决定，费用还会按 max 档预留
const GPT_IMAGE_FORMAT: RequestFormat = { fixedParams: { quality: 'medium' } };
// Seedream 5.5 的档位写法是大写的 1K / 2K；它的比例里没有 4:5，改用等价的精确像素尺寸
const SEEDREAM_FORMAT: RequestFormat = {
  exactSizes: { '4:5': { '1k': '896x1120', '2k': '1792x2240' } },
  resolutionValue: resolution => resolution.toUpperCase(),
};

const REQUEST_FORMATS: Record<ImageModel, RequestFormat> = {
  'gpt-image-2.6-flare': GPT_IMAGE_FORMAT,
  'gpt-image-2.6-sunburst': GPT_IMAGE_FORMAT,
  'gemini-nano-banana-2.1': {},
  'seedream-5-5': SEEDREAM_FORMAT,
  // 应用发出的写法它都直接接受：比例任意、档位兼容小写。输出格式和提示词扩写沿用接口默认
  'minimax-h3-image': {},
};

// 提交前校验模型相关的限制。提示里写明界面上的选项名和当前值，用户能照着改
function assertWithinModelLimits(request: ImageGenerationRequest): void {
  const { label, maxImageCount, maxReferenceImages, resolutions } =
    IMAGE_MODEL_DEFINITIONS[request.model];
  const count = request.n ?? 1;
  if (count > maxImageCount) {
    throw new Error(`${label} 每次最多生成 ${maxImageCount} 张，当前 ${count} 张，请调低张数`);
  }
  const referenceCount = request.imageUrls?.length ?? 0;
  if (referenceCount > maxReferenceImages) {
    throw new Error(
      `${label} 最多支持 ${maxReferenceImages} 张参考图，当前 ${referenceCount} 张，请减少参考图`,
    );
  }
  if (!resolutions.includes(request.resolution)) {
    const supported = resolutions.map(resolution => resolution.toUpperCase()).join('、');
    throw new Error(`${label} 支持的清晰度是 ${supported}，请调整清晰度`);
  }
}

// 比例在接口里有对应写法时传“比例 + 档位”，否则改用等价的精确像素尺寸，不再传档位
function toSizeParams(
  size: string,
  resolution: ImageResolution,
  format: RequestFormat,
): { resolution?: string; size: string } {
  const exactSize = format.exactSizes?.[size]?.[resolution];
  if (exactSize) return { size: exactSize };
  return { resolution: format.resolutionValue?.(resolution) ?? resolution, size };
}

function formatRequestBody(request: ImageGenerationRequest): Record<string, unknown> {
  const format = REQUEST_FORMATS[request.model];
  const { size, resolution } = toSizeParams(request.size, request.resolution, format);
  const body: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    size,
    ...format.fixedParams,
  };
  if (resolution !== undefined) body.resolution = resolution;
  if (request.n !== undefined) body.n = request.n;
  if (request.imageUrls && request.imageUrls.length) body.image_urls = request.imageUrls;
  return body;
}

// 校验模型相关的限制并构造请求体，不产生任何网络请求。
// 参考图需要先上传时请改用 prepareImageRequestBody
export function buildImageRequestBody(request: ImageGenerationRequest): Record<string, unknown> {
  assertWithinModelLimits(request);
  return formatRequestBody(request);
}

// 提交前的完整准备：校验、按模型准备参考图、构造请求体。
// 校验放在上传之前，参数超限时不会先产生上传
export async function prepareImageRequestBody(
  request: ImageGenerationRequest,
  apiKey: string,
): Promise<Record<string, unknown>> {
  assertWithinModelLimits(request);
  const imageUrls = await prepareImageReferences(request.imageUrls, request.model, apiKey);
  return formatRequestBody({ ...request, imageUrls });
}
