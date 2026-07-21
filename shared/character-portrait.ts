// 角色头像与设定图模块的类型定义
import type { CharacterScopeRequest } from './character-library';
import type { CharacterWorkspaceState } from './character';
import type { SaveFileRequest, SavedFileResult } from './desktop';

// 角色头像支持的尺寸
export const CHARACTER_PORTRAIT_SIZES = ['2:3', '3:4', '4:5', '1:1', '16:9'] as const;
// 角色头像支持的分辨率
export const CHARACTER_PORTRAIT_RESOLUTIONS = ['1k', '2k', '4k'] as const;
// 角色设定图固定尺寸
export const CHARACTER_SHEET_SIZE = '16:9' as const;
// 角色设定图最大参考图数量
export const MAX_CHARACTER_SHEET_REFERENCE_IMAGES = 16;

// 角色头像尺寸
export type CharacterPortraitSize = (typeof CHARACTER_PORTRAIT_SIZES)[number];
// 角色图片尺寸（头像或设定图）
export type CharacterImageSize = CharacterPortraitSize | typeof CHARACTER_SHEET_SIZE;
// 角色头像分辨率
export type CharacterPortraitResolution = (typeof CHARACTER_PORTRAIT_RESOLUTIONS)[number];
// 角色图片来源
export type CharacterImageSource = 'generated' | 'uploaded';
// 角色视觉素材类型
export type CharacterVisualAssetKind = 'portrait' | 'sheet';
// 角色头像任务状态
export type CharacterPortraitTaskStatus =
  | 'submitted'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

// 生成角色头像请求
export interface GenerateCharacterPortraitRequest {
  // 生成数量
  count: number;
  // 角色名称
  name: string;
  // 提示词
  prompt: string;
  // 分辨率
  resolution: CharacterPortraitResolution;
  // 尺寸
  size: CharacterPortraitSize;
}

// 角色头像图片
export interface CharacterPortraitImage {
  // 文件名
  fileName: string;
  // MIME 类型
  mimeType: string;
  // 显示名称（可选）
  name?: string;
  // 访问地址
  url: string;
}

// 角色图片记录（头像 / 设定图通用结构）
export interface CharacterImageRecord<TSize extends CharacterImageSize = CharacterImageSize> {
  // 生成数量
  count: number;
  // 创建时间
  createdAt: string;
  // 错误信息
  errorMessage: string | null;
  // 任务ID
  id: string;
  // 图片列表
  images: CharacterPortraitImage[];
  // 名称
  name: string;
  // 原始文件名
  originalName: string | null;
  // 生成进度
  progress: number;
  // 提示词
  prompt: string;
  // 分辨率
  resolution: CharacterPortraitResolution;
  // 图片来源
  source: CharacterImageSource;
  // 任务状态
  status: CharacterPortraitTaskStatus;
  // 尺寸
  size: TSize;
  // 更新时间
  updatedAt: string;
}

// 角色头像记录
export type CharacterPortraitRecord = CharacterImageRecord<CharacterPortraitSize>;

// 角色设定图记录
export interface CharacterSheetRecord extends CharacterImageRecord<typeof CHARACTER_SHEET_SIZE> {
  // 设定图固定为单张
  count: 1;
  // 设定图名称
  name: string;
  // 参考素材列表
  referenceAssets: CharacterVisualAssetSelection[];
  /** 已废弃：使用 referenceAssets，保留以兼容历史工作区数据 */
  referenceImage: CharacterPortraitSelection | null;
  // 尺寸
  size: typeof CHARACTER_SHEET_SIZE;
}

// 角色头像选择
export interface CharacterPortraitSelection {
  // 文件名
  fileName: string;
  // 任务ID
  taskId: string;
}

// 角色头像工作区状态
export interface CharacterPortraitWorkspaceState {
  // 官方视觉素材列表
  officialAssets: CharacterVisualAssetSelection[];
  // 头像记录列表
  records: CharacterPortraitRecord[];
  /** 已废弃：使用 officialAssets，老流程迁移期间保留 */
  selectedImage: CharacterPortraitSelection | null;
  /** 已废弃：使用 officialAssets，老流程迁移期间保留 */
  selectedSheet: CharacterPortraitSelection | null;
  // 设定图记录列表
  sheetRecords: CharacterSheetRecord[];
}

// 角色视觉素材选择
export interface CharacterVisualAssetSelection extends CharacterPortraitSelection {
  // 素材类型
  kind: CharacterVisualAssetKind;
}

// 选中角色头像请求
export interface SelectCharacterPortraitRequest {
  // 文件名
  fileName: string;
  // 任务ID
  taskId: string;
}

// 删除角色头像请求
export interface DeleteCharacterPortraitRequest {
  // 文件名
  fileName: string;
  // 任务ID
  taskId: string;
}

// 生成角色设定图请求
export interface GenerateCharacterSheetRequest {
  // 设定图名称
  name: string;
  // 提示词
  prompt: string;
  // 参考素材列表
  referenceAssets: CharacterVisualAssetSelection[];
  // 分辨率
  resolution: CharacterPortraitResolution;
}

// 重命名角色视觉素材请求
export interface RenameCharacterVisualAssetRequest extends CharacterVisualAssetSelection {
  // 新名称
  name: string;
}

// 设置角色视觉素材官方状态请求
export interface SetCharacterVisualAssetOfficialRequest extends CharacterVisualAssetSelection {
  // 是否设为官方
  official: boolean;
}

// 上传角色视觉素材请求
export interface UploadCharacterVisualAssetRequest {
  // 文件二进制内容
  fileData: Uint8Array;
  // 文件名
  fileName: string;
  // MIME 类型
  mimeType: string;
  // 素材名称
  name: string;
}

// 删除角色设定图请求
export type DeleteCharacterSheetRequest = DeleteCharacterPortraitRequest;
// 选中角色设定图请求
export type SelectCharacterSheetRequest = SelectCharacterPortraitRequest;

// 角色头像 API（含设定图与视觉素材管理）
export interface CharacterPortraitApi {
  // 删除角色头像
  deleteCharacterPortrait: (
    request: DeleteCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 删除角色设定图
  deleteCharacterSheet: (
    request: DeleteCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 生成角色头像
  generateCharacterPortrait: (
    request: GenerateCharacterPortraitRequest,
  ) => Promise<CharacterPortraitRecord>;
  // 生成角色设定图
  generateCharacterSheet: (request: GenerateCharacterSheetRequest) => Promise<CharacterSheetRecord>;
  // 查询角色头像任务
  getCharacterPortraitTask: (taskId: string) => Promise<CharacterPortraitRecord>;
  // 查询角色头像工作区
  getCharacterPortraitWorkspace: (
    request?: CharacterScopeRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 查询角色设定图任务
  getCharacterSheetTask: (taskId: string) => Promise<CharacterSheetRecord>;
  // 查询角色工作区
  getCharacterWorkspace: () => Promise<CharacterWorkspaceState>;
  // 重命名角色视觉素材
  renameCharacterVisualAsset: (
    request: RenameCharacterVisualAssetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 选中角色头像
  selectCharacterPortrait: (
    request: SelectCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 选中角色设定图
  selectCharacterSheet: (
    request: SelectCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 设为官方角色视觉素材
  setCharacterVisualAssetOfficial: (
    request: SetCharacterVisualAssetOfficialRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 上传角色头像
  uploadCharacterPortrait: (request: SaveFileRequest) => Promise<SavedFileResult>;
  // 上传角色视觉素材
  uploadCharacterVisualAsset: (
    request: UploadCharacterVisualAssetRequest,
  ) => Promise<SavedFileResult>;
  // 上传角色设定图
  uploadCharacterSheet: (request: SaveFileRequest) => Promise<SavedFileResult>;
}
