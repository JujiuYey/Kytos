import type { UIMessage } from 'ai';
import type { CharacterPortraitImage, CharacterPortraitTaskStatus } from './character-portrait';

export const CHARACTER_CREATE_AGENT_ENDPOINT = 'app://bundle/api/character-create-agent';

export interface CharacterCreateDraft {
  accessories: string;
  accentColor: string;
  age: string;
  backgroundColor: string;
  bottomsColor: string;
  bottomsLength: string;
  bottomsStyle: string;
  characterMood: string;
  clothingColor: string;
  clothingLength: string;
  clothingStyle: string;
  forbiddenColors: string;
  gender: string;
  hairColor: string;
  hairstyle: string;
  overallStyleKeywords: string;
  primaryColor: string;
  props: string;
  secondaryColor: string;
  shoesColor: string;
  shoesHeight: string;
  shoesStyle: string;
}

export interface CharacterCreateDraftUpdateResult {
  draft: CharacterCreateDraft;
  updatedFields: Array<keyof CharacterCreateDraft>;
}

export interface CharacterCreatePromptResult {
  draft: CharacterCreateDraft;
  prompt: string;
  ready: true;
}

type CharacterCreateAgentTools = {
  finalizeCharacterPrompt: {
    input: { draft: Partial<CharacterCreateDraft>; prompt: string };
    output: CharacterCreatePromptResult;
  };
  updateCharacterDraft: {
    input: Partial<CharacterCreateDraft>;
    output: CharacterCreateDraftUpdateResult;
  };
};

export type CharacterCreateAgentMessage = UIMessage<unknown, never, CharacterCreateAgentTools>;

export interface CharacterVisualReferenceImage {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
}

export interface GenerateCharacterVisualRequest {
  prompt: string;
  referenceImage?: CharacterVisualReferenceImage;
}

export interface GetCharacterVisualGenerationRequest {
  generationId: string;
}

export interface SaveCharacterVisualRequest {
  characterId?: string;
  generationId: string;
}

export interface SaveCharacterVisualAssetRequest extends CharacterVisualReferenceImage {
  characterId?: string;
  name?: string;
}

export interface SaveCharacterVisualResult {
  characterId: string;
  library: import('./character-library').CharacterLibraryState;
}

export interface CharacterVisualGeneration {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  image: CharacterPortraitImage | null;
  progress: number;
  status: CharacterPortraitTaskStatus;
  updatedAt: string;
}
