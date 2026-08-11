import { ref } from 'vue';

export function useCharacterAnchorUpload() {
  const uploadDialogOpen = ref(false);

  function openUploadDialog(): void {
    uploadDialogOpen.value = true;
  }

  return {
    openUploadDialog,
    uploadDialogOpen,
  };
}
