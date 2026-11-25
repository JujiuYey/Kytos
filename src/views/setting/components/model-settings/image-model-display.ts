// 生图模型在设置页上的展示数据：每项限制的说法，以及它是否比其他模型更严
import { IMAGE_MODEL_DEFINITIONS, IMAGE_MODELS } from '@/types';
import type { ImageModel } from '@/types';

export interface ImageModelLimit {
  label: string;
  // 表格里用的完整写法，省略时与 label 相同
  detail?: string;
  // 比所有模型里最宽松的一项更严
  stricter: boolean;
}

export interface ImageModelLimits {
  count: ImageModelLimit;
  references: ImageModelLimit;
  resolution: ImageModelLimit;
}

interface LimitBaseline {
  count: number;
  references: number;
  resolutionTiers: number;
}

// 以所有模型里最宽松的一项为基准
const widest: LimitBaseline = IMAGE_MODELS.reduce(
  (baseline, model) => {
    const definition = IMAGE_MODEL_DEFINITIONS[model];
    return {
      count: Math.max(baseline.count, definition.maxImageCount),
      references: Math.max(baseline.references, definition.maxReferenceImages),
      resolutionTiers: Math.max(baseline.resolutionTiers, definition.resolutions.length),
    };
  },
  { count: 0, references: 0, resolutionTiers: 0 },
);

function readLimits(model: ImageModel): ImageModelLimits {
  const definition = IMAGE_MODEL_DEFINITIONS[model];
  const tiers = definition.resolutions.map(resolution => resolution.toUpperCase());
  return {
    count: {
      label: definition.maxImageCount === 1 ? '单次 1 张' : `单次 1–${definition.maxImageCount} 张`,
      stricter: definition.maxImageCount < widest.count,
    },
    references: {
      label: `参考图最多 ${definition.maxReferenceImages} 张`,
      stricter: definition.maxReferenceImages < widest.references,
    },
    resolution: {
      detail: tiers.join('、'),
      label: `最高 ${tiers[tiers.length - 1] ?? ''}`,
      stricter: tiers.length < widest.resolutionTiers,
    },
  };
}

const limitsByModel = new Map<ImageModel, ImageModelLimits>(
  IMAGE_MODELS.map(model => [model, readLimits(model)] as const),
);

export function getImageModelLimits(model: ImageModel): ImageModelLimits {
  return limitsByModel.get(model) ?? readLimits(model);
}

// 每个模型一行里展示的三个限制标签，顺序固定：单次出图、参考图、清晰度
export function getImageModelBadges(model: ImageModel): ImageModelLimit[] {
  const limits = getImageModelLimits(model);
  return [limits.count, limits.references, limits.resolution];
}
