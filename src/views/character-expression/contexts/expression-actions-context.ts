import { inject, provide, type InjectionKey, type Ref } from 'vue';
import type { CharacterExpressionRecord, CharacterPortraitImage } from '@/types';

interface ExpressionActionsContext {
  deletingFileName: Readonly<Ref<string>>;
  renamingTaskId: Readonly<Ref<string>>;
  requestDelete: (record: CharacterExpressionRecord, image: CharacterPortraitImage) => void;
  requestRename: (record: CharacterExpressionRecord) => void;
}

const EXPRESSION_ACTIONS_KEY: InjectionKey<ExpressionActionsContext> = Symbol(
  'ExpressionActionsContext',
);

export function provideExpressionActions(context: ExpressionActionsContext): void {
  provide(EXPRESSION_ACTIONS_KEY, context);
}

export function useExpressionActions(): ExpressionActionsContext {
  const context = inject(EXPRESSION_ACTIONS_KEY);
  if (!context) {
    throw new Error('useExpressionActions must be used within an expression actions provider');
  }
  return context;
}
