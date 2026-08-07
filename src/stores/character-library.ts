import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type {
  CharacterLibraryCharacter,
  CreateCharacterRequest,
  DeleteCharacterRequest,
  UpdateCharacterRequest,
} from '@/types';

export const useCharacterLibraryStore = defineStore('character-library', () => {
  const characters = ref<CharacterLibraryCharacter[]>([]);
  const errorMessage = ref('');
  const isInitialized = ref(false);
  const isLoading = ref(false);
  let initializationPromise: Promise<void> | null = null;

  const characterCount = computed(() => characters.value.length);
  const hasCharacters = computed(() => characters.value.length > 0);

  async function refresh(): Promise<void> {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const library = await window.desktop.character.library.getCharacterLibrary();
      characters.value = library.characters;
      isInitialized.value = true;
    } catch (error: unknown) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function initialize(): Promise<void> {
    if (isInitialized.value) {
      return;
    }
    initializationPromise ??= refresh().finally(() => {
      initializationPromise = null;
    });
    await initializationPromise;
  }

  async function createCharacter(
    request: CreateCharacterRequest,
  ): Promise<CharacterLibraryCharacter> {
    const previousCharacterIds = new Set(characters.value.map(character => character.id));
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const library = await window.desktop.character.library.createCharacter(request);
      characters.value = library.characters;
      isInitialized.value = true;
      const createdCharacter = library.characters.find(
        character => !previousCharacterIds.has(character.id),
      );
      if (!createdCharacter) {
        throw new Error('角色创建成功但未找到角色');
      }
      return createdCharacter;
    } catch (error: unknown) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateCharacter(
    request: UpdateCharacterRequest,
  ): Promise<CharacterLibraryCharacter> {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const library = await window.desktop.character.library.updateCharacter(request);
      characters.value = library.characters;
      isInitialized.value = true;
      const updatedCharacter = library.characters.find(
        character => character.id === request.characterId,
      );
      if (!updatedCharacter) {
        throw new Error('角色更新成功但未找到角色');
      }
      return updatedCharacter;
    } catch (error: unknown) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteCharacter(request: DeleteCharacterRequest): Promise<void> {
    isLoading.value = true;
    errorMessage.value = '';
    try {
      const library = await window.desktop.character.library.deleteCharacter(request);
      characters.value = library.characters;
      isInitialized.value = true;
    } catch (error: unknown) {
      errorMessage.value = error instanceof Error ? error.message : String(error);
      throw error;
    } finally {
      isLoading.value = false;
    }
  }

  return {
    characterCount,
    characters,
    createCharacter,
    deleteCharacter,
    errorMessage,
    hasCharacters,
    initialize,
    isInitialized,
    isLoading,
    refresh,
    updateCharacter,
  };
});
