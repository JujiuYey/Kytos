// 桌面端 API 的类型定义与请求/响应模型聚合
import type { CharacterWorkspaceState } from './character';
import type {
  CharacterLibraryState,
  CharacterScopeRequest,
  DeleteCharacterRequest,
  SelectCharacterRequest,
} from './character-library';
import type {
  CharacterVisualGeneration,
  GenerateCharacterVisualRequest,
  GetCharacterVisualGenerationRequest,
  SaveCharacterVisualAssetRequest,
  SaveCharacterVisualRequest,
  SaveCharacterVisualResult,
} from './character-create';
import type {
  CharacterExpressionRecord,
  CharacterExpressionWorkspaceState,
  DeleteCharacterExpressionRequest,
  GenerateCharacterExpressionRequest,
  GenerateCharacterExpressionPromptRequest,
  GetCharacterExpressionTaskRequest,
  GetCharacterExpressionWorkspaceRequest,
  RenameCharacterExpressionRequest,
  UploadCharacterExpressionRequest,
} from './character-expression';
import type {
  CharacterPortraitRecord,
  CharacterPortraitWorkspaceState,
  CharacterSheetRecord,
  DeleteCharacterPortraitRequest,
  DeleteCharacterSheetRequest,
  GenerateCharacterPortraitRequest,
  GenerateCharacterSheetRequest,
  RenameCharacterVisualAssetRequest,
  SelectCharacterPortraitRequest,
  SelectCharacterSheetRequest,
  SetCharacterVisualAssetOfficialRequest,
  UploadCharacterVisualAssetRequest,
} from './character-portrait';
import type {
  CreateIllustrationTopicRequest,
  DeleteIllustrationUploadRequest,
  DeleteIllustrationTopicRequest,
  DeleteIllustrationVersionRequest,
  GenerateIllustrationRequest,
  IllustrationTopic,
  IllustrationVersion,
  IllustrationWorkspaceState,
  SaveIllustrationConversationRequest,
  UpdateIllustrationTopicRequest,
  UploadedIllustration,
  UploadIllustrationRequest,
} from './illustration';
import type {
  CreateStoryRequest,
  CreateStoryShotRequest,
  DeleteStoryRequest,
  DeleteStoryShotRequest,
  DeleteStoryShotVersionRequest,
  GenerateStoryShotRequest,
  MoveStoryShotRequest,
  SaveStoryConversationRequest,
  SelectStoryShotVersionRequest,
  StoryProject,
  StoryShotUpdateResult,
  StoryShotVersion,
  StoryWorkspaceState,
  UpdateStoryRequest,
  UpdateStoryShotRequest,
} from './story';

// 凭据服务类型
export type CredentialService = 'apimart' | 'deepseek';
// 桌面主题
export type DesktopTheme = 'dark' | 'light' | 'system';

// 桌面端设置
export interface DesktopSettings {
  // 建议工作区路径
  suggestedWorkspacePath: string;
  // 工作区路径
  workspacePath: string | null;
}

// 凭据状态
export interface CredentialStatus {
  // 是否已配置
  configured: boolean;
  // 安全存储是否可用
  secureStorageAvailable: boolean;
  // 服务标识
  service: CredentialService;
}

// 设置凭据请求
export interface SetCredentialRequest {
  // 服务标识
  service: CredentialService;
  // 凭据值
  value: string;
}

// 保存文件请求
export interface SaveFileRequest {
  // 文件名
  fileName: string;
  // 文件二进制内容
  fileData: Uint8Array;
  // MIME 类型
  mimeType: string;
}

// 已保存文件结果
export interface SavedFileResult {
  // 文件名
  fileName: string;
  // 原始文件名
  originalName: string;
  // 访问地址
  url: string;
  // 文件大小
  size: number;
  // MIME 类型
  mimeType: string;
}

// 桌面端 API 接口
export interface DesktopApi {
  // 创建故事
  createStory: (request: CreateStoryRequest) => Promise<StoryProject>;
  // 创建故事分镜
  createStoryShot: (request: CreateStoryShotRequest) => Promise<StoryProject>;
  // 创建插画主题
  createIllustrationTopic: (request: CreateIllustrationTopicRequest) => Promise<IllustrationTopic>;
  // 删除插画主题
  deleteIllustrationTopic: (
    request: DeleteIllustrationTopicRequest,
  ) => Promise<IllustrationWorkspaceState>;
  // 删除插画版本
  deleteIllustrationVersion: (
    request: DeleteIllustrationVersionRequest,
  ) => Promise<IllustrationTopic>;
  // 删除已上传插画
  deleteIllustrationUpload: (
    request: DeleteIllustrationUploadRequest,
  ) => Promise<IllustrationWorkspaceState>;
  // 删除角色表情
  deleteCharacterExpression: (
    request: DeleteCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  // 删除角色
  deleteCharacter: (request: DeleteCharacterRequest) => Promise<CharacterLibraryState>;
  // 删除角色头像
  deleteCharacterPortrait: (
    request: DeleteCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 删除角色设定图
  deleteCharacterSheet: (
    request: DeleteCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 删除凭据
  deleteCredential: (service: CredentialService) => Promise<CredentialStatus>;
  // 删除故事
  deleteStory: (request: DeleteStoryRequest) => Promise<StoryWorkspaceState>;
  // 删除故事分镜
  deleteStoryShot: (request: DeleteStoryShotRequest) => Promise<StoryProject>;
  // 删除故事分镜版本
  deleteStoryShotVersion: (request: DeleteStoryShotVersionRequest) => Promise<StoryProject>;
  // 生成角色表情
  generateCharacterExpression: (
    request: GenerateCharacterExpressionRequest,
  ) => Promise<CharacterExpressionRecord>;
  // 生成角色表情提示词
  generateCharacterExpressionPrompt: (
    request: GenerateCharacterExpressionPromptRequest,
  ) => Promise<string>;
  // 生成角色头像
  generateCharacterPortrait: (
    request: GenerateCharacterPortraitRequest,
  ) => Promise<CharacterPortraitRecord>;
  // 生成角色设定图
  generateCharacterSheet: (request: GenerateCharacterSheetRequest) => Promise<CharacterSheetRecord>;
  // 生成插画
  generateIllustration: (request: GenerateIllustrationRequest) => Promise<IllustrationVersion>;
  // 生成故事分镜
  generateStoryShot: (request: GenerateStoryShotRequest) => Promise<StoryShotVersion>;
  // 查询角色表情任务
  getCharacterExpressionTask: (
    request: GetCharacterExpressionTaskRequest,
  ) => Promise<CharacterExpressionRecord>;
  // 查询角色表情工作区
  getCharacterExpressionWorkspace: (
    request: GetCharacterExpressionWorkspaceRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  // 查询角色库
  getCharacterLibrary: () => Promise<CharacterLibraryState>;
  // 查询角色头像任务
  getCharacterPortraitTask: (taskId: string) => Promise<CharacterPortraitRecord>;
  // 查询角色头像工作区
  getCharacterPortraitWorkspace: (
    request?: CharacterScopeRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 查询角色设定图任务
  getCharacterSheetTask: (taskId: string) => Promise<CharacterSheetRecord>;
  // 生成角色视觉素材
  generateCharacterVisual: (
    request: GenerateCharacterVisualRequest,
  ) => Promise<CharacterVisualGeneration>;
  // 查询角色视觉素材生成结果
  getCharacterVisualGeneration: (
    request: GetCharacterVisualGenerationRequest,
  ) => Promise<CharacterVisualGeneration>;
  // 查询角色工作区
  getCharacterWorkspace: () => Promise<CharacterWorkspaceState>;
  // 查询插画任务
  getIllustrationTask: (taskId: string) => Promise<IllustrationVersion>;
  // 查询插画工作区
  getIllustrationWorkspace: () => Promise<IllustrationWorkspaceState>;
  // 查询故事分镜任务
  getStoryShotTask: (taskId: string) => Promise<StoryShotVersion>;
  // 查询故事工作区
  getStoryWorkspace: () => Promise<StoryWorkspaceState>;
  // 查询凭据状态
  getCredentialStatus: (service: CredentialService) => Promise<CredentialStatus>;
  // 查询桌面设置
  getSettings: () => Promise<DesktopSettings>;
  // 打开工作区目录
  openWorkspaceDirectory: () => Promise<void>;
  // 移动故事分镜
  moveStoryShot: (request: MoveStoryShotRequest) => Promise<StoryProject>;
  // 重命名角色表情
  renameCharacterExpression: (
    request: RenameCharacterExpressionRequest,
  ) => Promise<CharacterExpressionWorkspaceState>;
  // 重命名角色视觉素材
  renameCharacterVisualAsset: (
    request: RenameCharacterVisualAssetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 选择目录
  selectDirectory: () => Promise<string | null>;
  // 保存文件
  saveFile: (request: SaveFileRequest) => Promise<SavedFileResult>;
  // 保存角色视觉素材
  saveCharacterVisual: (request: SaveCharacterVisualRequest) => Promise<SaveCharacterVisualResult>;
  // 保存角色视觉素材资源
  saveCharacterVisualAsset: (
    request: SaveCharacterVisualAssetRequest,
  ) => Promise<SaveCharacterVisualResult>;
  // 保存插画会话
  saveIllustrationConversation: (
    request: SaveIllustrationConversationRequest,
  ) => Promise<IllustrationTopic>;
  // 保存故事会话
  saveStoryConversation: (request: SaveStoryConversationRequest) => Promise<StoryProject>;
  // 选中角色头像
  selectCharacterPortrait: (
    request: SelectCharacterPortraitRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 选中角色
  selectCharacter: (request: SelectCharacterRequest) => Promise<CharacterLibraryState>;
  // 选中角色设定图
  selectCharacterSheet: (
    request: SelectCharacterSheetRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 选中故事分镜版本
  selectStoryShotVersion: (request: SelectStoryShotVersionRequest) => Promise<StoryProject>;
  // 设置凭据
  setCredential: (request: SetCredentialRequest) => Promise<CredentialStatus>;
  // 设置主题
  setTheme: (theme: DesktopTheme) => Promise<void>;
  // 设为官方角色视觉素材
  setCharacterVisualAssetOfficial: (
    request: SetCharacterVisualAssetOfficialRequest,
  ) => Promise<CharacterPortraitWorkspaceState>;
  // 设置工作区目录
  setWorkspaceDirectory: (workspacePath: string) => Promise<DesktopSettings>;
  // 使用推荐工作区
  useSuggestedWorkspace: () => Promise<DesktopSettings>;
  // 上传角色头像
  uploadCharacterPortrait: (request: SaveFileRequest) => Promise<SavedFileResult>;
  // 上传角色视觉素材
  uploadCharacterVisualAsset: (
    request: UploadCharacterVisualAssetRequest,
  ) => Promise<SavedFileResult>;
  // 上传角色表情
  uploadCharacterExpression: (
    request: UploadCharacterExpressionRequest,
  ) => Promise<SavedFileResult>;
  // 上传角色设定图
  uploadCharacterSheet: (request: SaveFileRequest) => Promise<SavedFileResult>;
  // 上传插画
  uploadIllustration: (request: UploadIllustrationRequest) => Promise<UploadedIllustration>;
  // 更新插画主题
  updateIllustrationTopic: (request: UpdateIllustrationTopicRequest) => Promise<IllustrationTopic>;
  // 更新故事
  updateStory: (request: UpdateStoryRequest) => Promise<StoryProject>;
  // 更新故事分镜
  updateStoryShot: (request: UpdateStoryShotRequest) => Promise<StoryShotUpdateResult>;
}
