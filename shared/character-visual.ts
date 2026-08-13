// 角色视觉资产的公共类型与请求/响应模型
import type { ChatModel } from './chat-model';
import type { CharacterScopeRequest } from './character-library';
import type { SaveFileRequest, SavedFileResult } from './desktop';

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
// 核心身份参考图的单一职责；动作、表情和参考板不属于这些角色锚点槽位。
export const CHARACTER_ANCHOR_ROLES = [
  'unassigned',
  'standard',
  'turnaround',
  'face',
  'full-body',
  'three-quarter',
  'side',
  'back',
] as const;
export type CharacterAnchorRole = (typeof CHARACTER_ANCHOR_ROLES)[number];
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

export interface CharacterAnchorBinding extends CharacterVisualAssetSelection {
  role: CharacterAnchorRole;
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
  anchorBindings: CharacterAnchorBinding[];
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
  anchorRole?: Exclude<CharacterAnchorRole, 'unassigned' | 'standard'>;
  name: string;
  prompt: string;
  referenceAssets: CharacterVisualAssetSelection[];
  resolution: CharacterVisualResolution;
  size?: CharacterVisualSize;
}

export interface RenameCharacterVisualAssetRequest extends CharacterVisualAssetSelection {
  name: string;
}

export interface SetCharacterVisualAssetOfficialRequest extends CharacterVisualAssetSelection {
  official: boolean;
  role?: CharacterAnchorRole;
}

export interface CharacterVisualAssetUpload {
  fileData: Uint8Array;
  fileName: string;
  mimeType: string;
  name: string;
}

export interface UploadCharacterVisualAssetRequest
  extends CharacterScopeRequest, CharacterVisualAssetUpload {}

// 创建角色时上传已有视觉资产的请求
export interface SaveCharacterVisualAssetRequest extends SaveFileRequest {
  // 所属角色 ID
  characterId: string;
}

// 保存已有视觉资产后的角色库结果
export interface SaveCharacterVisualResult {
  // 角色 ID
  characterId: string;
  // 更新后的角色库状态
  library: import('./character-library').CharacterLibraryState;
}

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
  saveCharacterVisualAsset: (
    request: SaveCharacterVisualAssetRequest,
  ) => Promise<SaveCharacterVisualResult>;
}
