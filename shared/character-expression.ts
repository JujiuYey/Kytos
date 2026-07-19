import type {
  CharacterImageRecord,
  CharacterPortraitResolution,
  CharacterPortraitSelection,
  CharacterVisualAssetKind,
} from './character-portrait';
import type { CharacterScopeRequest } from './character-library';

export const CHARACTER_EXPRESSION_SIZES = ['1:1', '3:4', '4:5'] as const;
export const MAX_CHARACTER_EXPRESSION_REFERENCE_IMAGES = 16;

export type CharacterExpressionSize = (typeof CHARACTER_EXPRESSION_SIZES)[number];
export type CharacterExpressionReferenceKind = CharacterVisualAssetKind | 'expression';

export interface CharacterExpressionReferenceSelection extends CharacterPortraitSelection {
  kind: CharacterExpressionReferenceKind;
}

export interface GenerateCharacterExpressionRequest extends CharacterScopeRequest {
  count: number;
  description: string;
  name: string;
  referenceAssets: CharacterExpressionReferenceSelection[];
  resolution: CharacterPortraitResolution;
  size: CharacterExpressionSize;
}

export interface CharacterExpressionRecord
  extends
    CharacterImageRecord<CharacterExpressionSize>,
    Omit<GenerateCharacterExpressionRequest, 'characterId'> {}

export interface CharacterExpressionWorkspaceState {
  records: CharacterExpressionRecord[];
}

export interface DeleteCharacterExpressionRequest extends CharacterScopeRequest {
  fileName: string;
  taskId: string;
}

export interface RenameCharacterExpressionRequest extends CharacterScopeRequest {
  name: string;
  taskId: string;
}

export interface UploadCharacterExpressionRequest extends CharacterScopeRequest {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
  name: string;
}

export interface GetCharacterExpressionTaskRequest extends CharacterScopeRequest {
  taskId: string;
}

export type GetCharacterExpressionWorkspaceRequest = CharacterScopeRequest;

export interface GenerateCharacterExpressionPromptRequest {
  model: string;
  name: string;
}
