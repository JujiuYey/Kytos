import { ref } from 'vue';

export function useReferenceDialog() {
  const referenceDialogOpen = ref(false);

  function openReferenceDialog(): void {
    referenceDialogOpen.value = true;
  }

  return {
    openReferenceDialog,
    referenceDialogOpen,
  };
}
