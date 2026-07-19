export const CHARACTER_PORTRAIT_SIZES = ['2:3', '3:4', '4:5', '1:1'] as const;
export const CHARACTER_PORTRAIT_RESOLUTIONS = ['1k', '2k', '4k'] as const;
export const CHARACTER_SHEET_SIZE = '16:9' as const;

export type CharacterPortraitSize = (typeof CHARACTER_PORTRAIT_SIZES)[number];
export type CharacterImageSize = CharacterPortraitSize | typeof CHARACTER_SHEET_SIZE;
export type CharacterPortraitResolution = (typeof CHARACTER_PORTRAIT_RESOLUTIONS)[number];
export type CharacterImageSource = 'generated' | 'uploaded';
export type CharacterVisualAssetKind = 'portrait' | 'sheet';
export type CharacterPortraitTaskStatus =
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface GenerateCharacterPortraitRequest {
  count: number;
  name: string;
  prompt: string;
  resolution: CharacterPortraitResolution;
  size: CharacterPortraitSize;
}

export interface CharacterPortraitImage {
  fileName: string;
  mimeType: string;
  name?: string;
  url: string;
}

export interface CharacterImageRecord<TSize extends CharacterImageSize = CharacterImageSize> {
  count: number;
  createdAt: string;
  errorMessage: string | null;
  id: string;
  images: CharacterPortraitImage[];
  name: string;
  originalName: string | null;
  progress: number;
  prompt: string;
  resolution: CharacterPortraitResolution;
  source: CharacterImageSource;
  status: CharacterPortraitTaskStatus;
  size: TSize;
  updatedAt: string;
}

export interface CharacterPortraitRecord
  extends CharacterImageRecord<CharacterPortraitSize>, GenerateCharacterPortraitRequest {}

export interface CharacterSheetRecord extends CharacterImageRecord<typeof CHARACTER_SHEET_SIZE> {
  count: 1;
  name: string;
  referenceImage: CharacterPortraitSelection | null;
  size: typeof CHARACTER_SHEET_SIZE;
}

export interface CharacterPortraitSelection {
  fileName: string;
  taskId: string;
}

export interface CharacterPortraitWorkspaceState {
  officialAssets: CharacterVisualAssetSelection[];
  records: CharacterPortraitRecord[];
  /** @deprecated Use officialAssets. Kept while older generation flows are migrated. */
  selectedImage: CharacterPortraitSelection | null;
  /** @deprecated Use officialAssets. Kept while older generation flows are migrated. */
  selectedSheet: CharacterPortraitSelection | null;
  sheetRecords: CharacterSheetRecord[];
}

export interface CharacterVisualAssetSelection extends CharacterPortraitSelection {
  kind: CharacterVisualAssetKind;
}

export interface SelectCharacterPortraitRequest {
  fileName: string;
  taskId: string;
}

export interface DeleteCharacterPortraitRequest {
  fileName: string;
  taskId: string;
}

export interface GenerateCharacterSheetRequest {
  name: string;
  prompt: string;
  referenceAsset?: CharacterVisualAssetSelection;
  resolution: CharacterPortraitResolution;
}

export interface RenameCharacterVisualAssetRequest extends CharacterVisualAssetSelection {
  name: string;
}

export interface SetCharacterVisualAssetOfficialRequest extends CharacterVisualAssetSelection {
  official: boolean;
}

export interface UploadCharacterVisualAssetRequest {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
  name: string;
}

export type DeleteCharacterSheetRequest = DeleteCharacterPortraitRequest;
export type SelectCharacterSheetRequest = SelectCharacterPortraitRequest;
