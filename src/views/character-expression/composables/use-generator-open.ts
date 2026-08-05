import { ref } from 'vue';

export function useGeneratorOpen() {
  const generatorOpen = ref(true);

  function openGenerator(): void {
    generatorOpen.value = true;
  }

  function closeGenerator(): void {
    generatorOpen.value = false;
  }

  return {
    generatorOpen,
    openGenerator,
    closeGenerator,
  };
}
