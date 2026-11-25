// 图片生成模型定义
// 文档：
//   GPT-Image-2.6   https://docs.apimart.ai/cn/api-reference/images/gpt-image-2.6/generation
//   Nano Banana 2.1 https://docs.apimart.ai/cn/api-reference/images/gemini-nano-banana-2.1/generation
//   Seedream 5.5    https://docs.apimart.ai/cn/api-reference/images/seedream-5-5/generation
//   MiniMax H3 Image https://docs.apimart.ai/cn/api-reference/images/minimax-h3-image/generation
export const IMAGE_MODELS = [
  'gpt-image-2.6-flare',
  'gpt-image-2.6-sunburst',
  'gemini-nano-banana-2.1',
  'seedream-5-5',
  'minimax-h3-image',
] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];

export const IMAGE_RESOLUTIONS = ['1k', '2k', '4k'] as const;
export type ImageResolution = (typeof IMAGE_RESOLUTIONS)[number];

export interface ImageModelDefinition {
  id: ImageModel;
  label: string;
  // 一句话的特点或定位
  summary: string;
  // 应用内单次请求最多出图张数
  maxImageCount: number;
  // 参考图张数上限
  maxReferenceImages: number;
  // 支持的分辨率档位
  resolutions: readonly ImageResolution[];
  // 生成接口是否接受 data URI 形式的参考图；不接受时参考图要先经上传接口换成公网 URL
  acceptsDataUriReferences: boolean;
  // 以下三项是设置页对比表里的说明文字
  outputFormat: string;
  promptHandling: string;
  billing: string;
}

const ALL_RESOLUTIONS: readonly ImageResolution[] = IMAGE_RESOLUTIONS;

// 两项说明文字与 GPT-Image-2.6 的请求方式一致：档位固定为 medium，参考图先上传
const GPT_IMAGE_NOTES = {
  billing: '按 token 用量计费，质量档位固定为 medium',
  outputFormat: 'PNG',
  promptHandling: '文档未说明',
} as const;

export const IMAGE_MODEL_DEFINITIONS: Record<ImageModel, ImageModelDefinition> = {
  'gpt-image-2.6-flare': {
    ...GPT_IMAGE_NOTES,
    acceptsDataUriReferences: false,
    id: 'gpt-image-2.6-flare',
    label: 'GPT-Image-2.6 Flare',
    maxImageCount: 4,
    maxReferenceImages: 16,
    resolutions: ALL_RESOLUTIONS,
    summary: '速度优先，适合反复尝试',
  },
  'gpt-image-2.6-sunburst': {
    ...GPT_IMAGE_NOTES,
    acceptsDataUriReferences: false,
    id: 'gpt-image-2.6-sunburst',
    label: 'GPT-Image-2.6 Sunburst',
    maxImageCount: 4,
    maxReferenceImages: 16,
    resolutions: ALL_RESOLUTIONS,
    summary: '细节与编辑一致性优先，适合多轮修改',
  },
  // 官方版：按 token 计费，单次可出 1 到 4 张。Ext 版按张计费，但只能出 1 张，未接入。
  // 接口未设参考图张数上限，这里沿用应用自身的 16 张上限
  'gemini-nano-banana-2.1': {
    acceptsDataUriReferences: true,
    billing: '按实际 token 用量计费',
    id: 'gemini-nano-banana-2.1',
    label: 'Nano Banana 2.1',
    maxImageCount: 4,
    maxReferenceImages: 16,
    outputFormat: 'PNG 或 JPEG',
    promptHandling: '文档未说明',
    resolutions: ALL_RESOLUTIONS,
    summary: 'Gemini 图像模型的官方版，按实际用量计费',
  },
  // 每次只出 1 张。清晰度只有 1K / 1.5K / 2K，应用内不提供 1.5K，所以只列 1K 和 2K
  'seedream-5-5': {
    acceptsDataUriReferences: true,
    billing: '按张计费，按清晰度档位定价；每张参考图另计费',
    id: 'seedream-5-5',
    label: 'Seedream 5.5',
    maxImageCount: 1,
    maxReferenceImages: 10,
    outputFormat: 'PNG',
    promptHandling: '先自动优化提示词，不能关闭',
    resolutions: ['1k', '2k'],
    summary: '按张计费，费用按清晰度档位定价',
  },
  // 标准版。极速版 minimax-h3-image-highspeed 是另一个模型，未接入。
  // 接口单次上限 10 张，应用里的候选张数最多 4 张，这里记的是应用内的上限
  'minimax-h3-image': {
    acceptsDataUriReferences: true,
    billing: '4K 的单价约为 1K、2K 的 3 倍',
    id: 'minimax-h3-image',
    label: 'MiniMax H3 Image',
    maxImageCount: 4,
    maxReferenceImages: 16,
    outputFormat: 'JPEG',
    promptHandling: '默认先自动扩写；带参考图时不能关闭',
    resolutions: ALL_RESOLUTIONS,
    summary: '擅长写实摄影、海报、产品图和带文字的画面',
  },
};

// GPT-Image-2.6 两个型号同价：sunburst 偏细节与编辑一致性，对应本项目以参考图为主的生成；flare 偏速度
export const DEFAULT_IMAGE_MODEL: ImageModel = 'gpt-image-2.6-sunburst';

export function isImageModel(value: unknown): value is ImageModel {
  return typeof value === 'string' && IMAGE_MODELS.includes(value as ImageModel);
}
