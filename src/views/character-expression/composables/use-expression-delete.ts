import { ref, type Ref } from 'vue';
import { toast } from 'vue-sonner';
import type { CharacterExpressionRecord, CharacterVisualImage } from '@/types';
import { toErrorMessage } from '@/utils/helpers';

interface DeleteTarget {
  image: CharacterVisualImage;
  record: CharacterExpressionRecord;
}

interface UseExpressionDeleteOptions {
  characterId: Ref<string>;
  onDeleted: (records: CharacterExpressionRecord[]) => void;
}

export function useExpressionDelete(options: UseExpressionDeleteOptions) {
  const deleteDialogOpen = ref(false);
  const deleteTarget = ref<DeleteTarget | null>(null);
  const deletingFileName = ref('');

  function requestDelete(record: CharacterExpressionRecord, image: CharacterVisualImage): void {
    deleteTarget.value = { image, record };
    deleteDialogOpen.value = true;
  }

  async function deleteExpression(): Promise<void> {
    const target = deleteTarget.value;
    if (!target || deletingFileName.value) {
      return;
    }

    deletingFileName.value = target.image.fileName;
    try {
      const workspace = await window.desktop.character.expression.deleteCharacterExpression({
        characterId: options.characterId.value,
        fileName: target.image.fileName,
        taskId: target.record.id,
      });
      options.onDeleted(workspace.records);
      deleteDialogOpen.value = false;
      deleteTarget.value = null;
      toast.success('表情已删除');
    } catch (error: unknown) {
      toast.error(toErrorMessage(error));
    } finally {
      deletingFileName.value = '';
    }
  }

  return {
    deleteDialogOpen,
    deleteExpression,
    deletingFileName,
    requestDelete,
  };
}
