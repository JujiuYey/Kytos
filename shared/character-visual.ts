// 角色视觉资产的公共类型与请求/响应模型
import type { ChatModel } from './character';
import type { CharacterScopeRequest } from './character-library';
import type { SavedFileResult } from './desktop';

// 角色视觉支持的尺寸
export const CHARACTER_VISUAL_SIZES = ['2:3', '3:4', '4:5', '1:1', '16:9'] as const;
// 角色视觉支持的分辨率
export const CHARACTER_VISUAL_RESOLUTIONS = ['1k', '2k', '4k'] as const;
// 参考板生成使用的尺寸
export const CHARACTER_REFERENCE_BOARD_SIZE = '16:9' as const;
// 参考板最大参考图数量
export const MAX_CHARACTER_REFERENCE_IMAGES = 16;
// 角色动作描述最大长度
export const MAX_CHARACTER_ACTION_LENGTH = 500;

export type CharacterVisualSize = (typeof CHARACTER_VISUAL_SIZES)[number];
export type CharacterVisualResolution = (typeof CHARACTER_VISUAL_RESOLUTIONS)[number];
export type CharacterVisualSource = 'generated' | 'uploaded';
export type CharacterVisualTaskStatus =
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// 视觉资产图片
export interface CharacterVisualImage {
  fileName: string;
  mimeType: string;
  name?: string;
  url: string;
}

// 视觉资产选择。资产类别属于存储实现，不进入业务选择模型。
export interface CharacterVisualAssetSelection {
  fileName: string;
  taskId: string;
}

// 统一的视觉资产记录
export interface CharacterVisualAssetRecord<
  TSize extends CharacterVisualSize = CharacterVisualSize,
> {
  count: number;
  createdAt: string;
  errorMessage: string | null;
  // 生成记录所属工作流；上传资产没有该值
  generationMode?: 'action' | 'reference-board' | null;
  id: string;
  images: CharacterVisualImage[];
  name: string;
  originalName: string | null;
  progress: number;
  prompt: string;
  referenceAssets: CharacterVisualAssetSelection[];
  resolution: CharacterVisualResolution;
  size: TSize;
  source: CharacterVisualSource;
  status: CharacterVisualTaskStatus;
  updatedAt: string;
}

export interface CharacterVisualWorkspaceState {
  officialAssets: CharacterVisualAssetSelection[];
  records: CharacterVisualAssetRecord[];
}

export interface GenerateCharacterActionRequest {
  action: string;
  count: number;
  name: string;
  referenceAsset: CharacterVisualAssetSelection;
  resolution: CharacterVisualResolution;
  size: CharacterVisualSize;
}

export interface GenerateCharacterActionPromptRequest {
  model: ChatModel;
  name: string;
}

export interface GenerateCharacterReferenceBoardRequest {
  name: string;
  prompt: string;
  referenceAssets: CharacterVisualAssetSelection[];
  resolution: CharacterVisualResolution;
}

export interface RenameCharacterVisualAssetRequest extends CharacterVisualAssetSelection {
  name: string;
}

export interface SetCharacterVisualAssetOfficialRequest extends CharacterVisualAssetSelection {
  official: boolean;
}

export interface CharacterVisualAssetUpload {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
  name: string;
}

export interface UploadCharacterVisualAssetRequest
  extends CharacterScopeRequest, CharacterVisualAssetUpload {}

export interface CharacterVisualAssetApi {
  deleteCharacterVisualAsset: (
    request: CharacterVisualAssetSelection,
  ) => Promise<CharacterVisualWorkspaceState>;
  generateCharacterAction: (
    request: GenerateCharacterActionRequest,
  ) => Promise<CharacterVisualAssetRecord>;
  generateCharacterActionPrompt: (request: GenerateCharacterActionPromptRequest) => Promise<string>;
  generateCharacterReferenceBoard: (
    request: GenerateCharacterReferenceBoardRequest,
  ) => Promise<CharacterVisualAssetRecord>;
  getCharacterVisualAssetTask: (taskId: string) => Promise<CharacterVisualAssetRecord>;
  getCharacterVisualWorkspace: (
    request?: CharacterScopeRequest,
  ) => Promise<CharacterVisualWorkspaceState>;
  renameCharacterVisualAsset: (
    request: RenameCharacterVisualAssetRequest,
  ) => Promise<CharacterVisualWorkspaceState>;
  setCharacterVisualAssetOfficial: (
    request: SetCharacterVisualAssetOfficialRequest,
  ) => Promise<CharacterVisualWorkspaceState>;
  uploadCharacterVisualAsset: (
    request: UploadCharacterVisualAssetRequest,
  ) => Promise<SavedFileResult>;
}
