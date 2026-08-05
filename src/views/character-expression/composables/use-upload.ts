import { ref } from 'vue';

export function useUpload() {
  const uploadDialogOpen = ref(false);

  function openUploadDialog(): void {
    uploadDialogOpen.value = true;
  }

  return {
    uploadDialogOpen,
    openUploadDialog,
  };
}
