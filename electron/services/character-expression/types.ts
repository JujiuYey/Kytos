// character-expression 模块内部类型
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
  CharacterExpressionTask,
} from '../../../shared/character-expression';
import type { CharacterVisualImage } from '../../../shared/character-visual';

// 表情库 JSON 持久化
export interface StoredExpressionWorkspace {
  // 表情列表
  records: CharacterExpressionRecord[];
  // 版本号，确保 store 文件版本与运行时校验对齐
  version: 2;
}

// 表情生成任务按 taskId 索引，避免轮询时扫描正式资产数组
export interface StoredExpressionTaskWorkspace {
  tasks: Record<string, CharacterExpressionTask>;
  version: 1;
}

// 表情生成可用的参考图数据
export interface ExpressionReferenceData {
  // 参考图所在的工作区子目录
  directoryName: string;
  // 图片元信息
  image: CharacterVisualImage;
  // 用户在 UI 上选中的引用，避免后续 IO 时再回查
  selection: CharacterExpressionReferenceSelection;
}
