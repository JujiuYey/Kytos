import { inject, provide, type InjectionKey, type Ref } from 'vue';
import type { GenerationTaskPollingState } from '@/components/sag/generation-polling-status';
import type { CharacterExpressionRecord, CharacterVisualImage } from '@/types';

interface ExpressionRecordsContext {
  deletingFileName: Readonly<Ref<string>>;
  editExpression: (record: CharacterExpressionRecord, image: CharacterVisualImage) => void;
  pollingState: Readonly<Ref<GenerationTaskPollingState>>;
  renamingTaskId: Readonly<Ref<string>>;
  requestDelete: (record: CharacterExpressionRecord, image: CharacterVisualImage) => void;
  requestRename: (record: CharacterExpressionRecord) => void;
}

const EXPRESSION_RECORDS_KEY: InjectionKey<ExpressionRecordsContext> = Symbol(
  'ExpressionRecordsContext',
);

export function provideExpressionRecords(context: ExpressionRecordsContext): void {
  provide(EXPRESSION_RECORDS_KEY, context);
}

export function useExpressionRecords(): ExpressionRecordsContext {
  const context = inject(EXPRESSION_RECORDS_KEY);
  if (!context) {
    throw new Error('useExpressionRecords must be used within an expression records provider');
  }
  return context;
}
