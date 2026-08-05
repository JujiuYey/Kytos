import { ref, type Ref } from 'vue';
import { toast } from 'vue-sonner';
import type { CharacterExpressionRecord } from '@/types';
import { toErrorMessage } from '@/utils/helpers';

interface UseExpressionRenameOptions {
  characterId: Ref<string>;
  onRenamed: (records: CharacterExpressionRecord[]) => void;
}

export function useExpressionRename(options: UseExpressionRenameOptions) {
  const renameDialogOpen = ref(false);
  const renameTarget = ref<CharacterExpressionRecord | null>(null);
  const renamingTaskId = ref('');

  function requestRename(record: CharacterExpressionRecord): void {
    renameTarget.value = record;
    renameDialogOpen.value = true;
  }

  async function renameExpression(nextName: string): Promise<void> {
    const target = renameTarget.value;
    if (!target || renamingTaskId.value) {
      return;
    }

    renamingTaskId.value = target.id;
    try {
      const workspace = await window.desktop.character.expression.renameCharacterExpression({
        characterId: options.characterId.value,
        name: nextName,
        taskId: target.id,
      });
      options.onRenamed(workspace.records);
      renameDialogOpen.value = false;
      renameTarget.value = null;
      toast.success('表情名称已更新');
    } catch (error: unknown) {
      toast.error(toErrorMessage(error));
    } finally {
      renamingTaskId.value = '';
    }
  }

  return {
    renameDialogOpen,
    renameExpression,
    renameTarget,
    renamingTaskId,
    requestRename,
  };
}
