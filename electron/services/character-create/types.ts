// character-create 模块持久化类型
import type { CharacterVisualGeneration } from '../../../shared/character-create';

export interface StoredGeneration extends CharacterVisualGeneration {
  taskId: string;
}

export interface StoredGenerationStore {
  generations: StoredGeneration[];
  version: 1;
}
