import { ref, type Ref } from 'vue';

interface UseCharacterVisualGeneratorOptions {
  disabled: Ref<boolean>;
  onOpen?: () => void;
}

export function useCharacterVisualGenerator(options: UseCharacterVisualGeneratorOptions) {
  const generatorOpen = ref(false);

  function openGenerator(): void {
    if (options.disabled.value) {
      return;
    }
    generatorOpen.value = true;
    options.onOpen?.();
  }

  function closeGenerator(): void {
    generatorOpen.value = false;
  }

  return {
    closeGenerator,
    generatorOpen,
    openGenerator,
  };
}
