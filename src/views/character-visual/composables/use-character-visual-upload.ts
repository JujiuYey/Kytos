import { ref } from 'vue';

export function useCharacterVisualUpload() {
  const uploadDialogOpen = ref(false);

  function openUploadDialog(): void {
    uploadDialogOpen.value = true;
  }

  return {
    openUploadDialog,
    uploadDialogOpen,
  };
}
