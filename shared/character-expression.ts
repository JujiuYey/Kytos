import type {
  CharacterImageRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
} from './character-portrait';

export const CHARACTER_EXPRESSION_SIZES = ['1:1', '3:4', '4:5'] as const;

export type CharacterExpressionSize = (typeof CHARACTER_EXPRESSION_SIZES)[number];

export interface GenerateCharacterExpressionRequest {
  count: number;
  description: string;
  name: string;
  resolution: CharacterPortraitResolution;
  size: CharacterExpressionSize;
}

export interface CharacterExpressionRecord
  extends CharacterImageRecord<CharacterExpressionSize>, GenerateCharacterExpressionRequest {
  referencePortrait: CharacterPortraitSelection | null;
  referenceSheet: CharacterPortraitSelection | null;
}

export interface CharacterExpressionWorkspaceState {
  records: CharacterExpressionRecord[];
}

export interface DeleteCharacterExpressionRequest {
  fileName: string;
  taskId: string;
}

export interface RenameCharacterExpressionRequest {
  name: string;
  taskId: string;
}

export interface UploadCharacterExpressionRequest {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
  name: string;
}
