import { ref, type Ref } from 'vue';

interface UseCharacterAnchorGeneratorOptions {
  disabled: Ref<boolean>;
  onOpen?: () => void;
}

export function useCharacterAnchorGenerator(options: UseCharacterAnchorGeneratorOptions) {
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
