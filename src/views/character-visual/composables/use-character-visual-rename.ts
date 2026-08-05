import { ref } from 'vue';
import { toast } from 'vue-sonner';
import { toErrorMessage } from '@/utils/helpers';
import type { CharacterVisualAssetRecord, CharacterVisualImage } from '@/types';

interface RenameTarget {
  image: CharacterVisualImage;
  record: CharacterVisualAssetRecord;
}

interface UseCharacterVisualRenameOptions {
  onRenamed: (records: CharacterVisualAssetRecord[]) => void;
}

export function useCharacterVisualRename(options: UseCharacterVisualRenameOptions) {
  const renameDialogOpen = ref(false);
  const renamingFileName = ref('');
  const renameTarget = ref<RenameTarget | null>(null);

  function requestRename(record: CharacterVisualAssetRecord, image: CharacterVisualImage): void {
    renameTarget.value = { image, record };
    renameDialogOpen.value = true;
  }

  async function renameAsset(nextName: string): Promise<void> {
    const target = renameTarget.value;
    if (!target) {
      return;
    }
    renamingFileName.value = target.image.fileName;
    try {
      const workspace = await window.desktop.character.assets.renameCharacterVisualAsset({
        fileName: target.image.fileName,
        name: nextName,
        taskId: target.record.id,
      });
      options.onRenamed(workspace.records);
      renameDialogOpen.value = false;
      renameTarget.value = null;
      toast.success('图片名称已更新');
    } catch (error: unknown) {
      toast.error(toErrorMessage(error));
    } finally {
      renamingFileName.value = '';
    }
  }

  return {
    renameAsset,
    renameDialogOpen,
    renameTarget,
    renamingFileName,
    requestRename,
  };
}
