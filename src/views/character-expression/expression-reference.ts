import type { CharacterExpressionReferenceSelection, CharacterVisualImage } from '@/types';

// 参考图在选择器中的展示分类。
export type ExpressionReferenceSource = 'expression' | 'visual';

// 表情生成页使用的参考图选项，将选择器展示信息与生成请求所需的定位信息组合在一起。
export interface ExpressionReferenceOption {
  // 补充说明图片的资产类型、尺寸或来源。
  detail: string;
  // 用于预览参考图的图片信息。
  image: CharacterVisualImage;
  // 供列表渲染和选中状态匹配使用的稳定唯一键。
  key: string;
  // 展示给用户的参考图名称。
  label: string;
  // 提交生成请求时用于定位原始图片的领域数据。
  selection: CharacterExpressionReferenceSelection;
  // 选择器的筛选分组：已有表情或角色视觉资产。
  source: ExpressionReferenceSource;
}
