import type { CharacterDraft } from './character';
import type { CharacterPortraitImage, CharacterPortraitTaskStatus } from './character-portrait';

export const CHARACTER_VISUAL_CARD_COUNT = 3;

export interface CharacterVisualHypothesis {
  prompt: string;
  summary: string;
  tags: string[];
  title: string;
}

export interface CharacterVisualCard extends CharacterVisualHypothesis {
  createdAt: string;
  errorMessage: string | null;
  id: string;
  image: CharacterPortraitImage | null;
  progress: number;
  status: CharacterPortraitTaskStatus;
  taskId: string | null;
  updatedAt: string;
}

export interface CharacterVisualCardDraw {
  cards: CharacterVisualCard[];
  createdAt: string;
  draftSnapshot: CharacterDraft;
  guidance: string | null;
  id: string;
  updatedAt: string;
}

export interface CharacterVisualCardWorkspaceState {
  draws: CharacterVisualCardDraw[];
}

export interface GenerateCharacterVisualCardsRequest {
  guidance?: string;
  model: string;
}

export interface GetCharacterVisualCardTaskRequest {
  cardId: string;
  drawId: string;
}
