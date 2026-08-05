// character-expression 模块内部类型
import type {
  CharacterExpressionRecord,
  CharacterExpressionReferenceSelection,
} from '../../../shared/character-expression';
import type { CharacterVisualImage } from '../../../shared/character-visual';

export interface StoredExpressionWorkspace {
  records: CharacterExpressionRecord[];
  version: 2;
}

export interface ExpressionReferenceData {
  directoryName: string;
  image: CharacterVisualImage;
  selection: CharacterExpressionReferenceSelection;
}
