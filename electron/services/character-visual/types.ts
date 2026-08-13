// character-visual 模块内部类型
import type {
  CharacterAnchorBinding,
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualWorkspaceState,
} from '../../../shared/character-visual';

export type LegacyVisualAssetKind = 'portrait' | 'sheet';

export interface LegacyVisualAssetSelection extends CharacterVisualAssetSelection {
  kind: LegacyVisualAssetKind;
}

export interface LegacyActionRecord extends Omit<CharacterVisualAssetRecord, 'referenceAssets'> {
  referenceAsset?: LegacyVisualAssetSelection | null;
}

export interface LegacyReferenceBoardRecord extends Omit<
  CharacterVisualAssetRecord,
  'referenceAssets'
> {
  anchorRole?: Extract<
    import('../../../shared/character-visual').CharacterAnchorRole,
    'turnaround' | 'face' | 'full-body' | 'three-quarter' | 'side' | 'back'
  >;
  count: 1;
  referenceAssets: LegacyVisualAssetSelection[];
  referenceImage: CharacterVisualAssetSelection | null;
  size: import('../../../shared/character-visual').CharacterVisualSize;
}

export interface StoredVisualWorkspace {
  anchorBindings: CharacterAnchorBinding[];
  officialAssets: LegacyVisualAssetSelection[];
  records: LegacyActionRecord[];
  selectedImage: CharacterVisualAssetSelection | null;
  selectedSheet: CharacterVisualAssetSelection | null;
  sheetRecords: LegacyReferenceBoardRecord[];
  version: 3;
}

export interface OfficialCharacterVisualReference {
  directoryName: string;
  image: CharacterVisualImage;
  selection: CharacterVisualAssetSelection;
}

export type CharacterVisualReference = OfficialCharacterVisualReference;

export interface VisualAssetMatch {
  directoryName: string;
  image: CharacterVisualImage;
  record: LegacyActionRecord | LegacyReferenceBoardRecord;
  selection: LegacyVisualAssetSelection;
}

export type {
  CharacterVisualAssetRecord,
  CharacterVisualAssetSelection,
  CharacterVisualImage,
  CharacterVisualWorkspaceState,
};
