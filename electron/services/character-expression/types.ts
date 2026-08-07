// character-expression 模块内部类型
import type { CharacterExpressionReferenceSelection } from '../../../shared/character-expression';
import type { CharacterVisualImage } from '../../../shared/character-visual';

// 表情生成可用的参考图数据
export interface ExpressionReferenceData {
  // 参考图所在的工作区子目录
  directoryName: string;
  // 图片元信息
  image: CharacterVisualImage;
  // 用户在 UI 上选中的引用，避免后续 IO 时再回查
  selection: CharacterExpressionReferenceSelection;
}
