import type { CharacterExpressionReferenceSelection, CharacterPortraitImage } from '@/types';

export type ExpressionReferenceSource = 'expression' | 'visual';

export interface ExpressionReferenceOption {
  detail: string;
  image: CharacterPortraitImage;
  key: string;
  label: string;
  selection: CharacterExpressionReferenceSelection;
  source: ExpressionReferenceSource;
}
